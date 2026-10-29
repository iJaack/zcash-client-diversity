import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createAppServer, createDashboardService } from "../server/app.ts";

const stats = JSON.parse(
  readFileSync(
    new URL("./fixtures/zecblock-stats.json", import.meta.url),
    "utf8",
  ),
);
const history = JSON.parse(
  readFileSync(
    new URL("./fixtures/zecblock-history.json", import.meta.url),
    "utf8",
  ),
);
const upstream = (input: string | URL | Request) => {
  if (!String(input).includes("/history?")) return stats;
  const result = structuredClone(history);
  result.data.period = new URL(String(input)).searchParams.get("period");
  return result;
};
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });

test("resources cache for 60 seconds and concurrent reads coalesce", async () => {
  let clock = 0;
  let calls = 0;
  const service = createDashboardService({
    now: () => clock,
    fetch: async (input) => {
      calls += 1;
      return json(upstream(input));
    },
  });
  const [one, two] = await Promise.all([
    service.getDashboard("7d"),
    service.getDashboard("7d"),
  ]);
  assert.equal(one.current.data?.total, 467);
  assert.equal(two.history.data?.length, 3);
  assert.equal(calls, 2);
  const cached = await service.getDashboard("7d");
  assert.equal(cached.current.cached, true);
  assert.equal(calls, 2);
  clock = 60_001;
  const renewed = await service.getDashboard("7d");
  assert.equal(renewed.current.cached, false);
  assert.equal(calls, 4);
});

test("history periods have separate caches and fixed upstream URLs", async () => {
  const urls: string[] = [];
  const service = createDashboardService({
    fetch: async (input) => {
      urls.push(String(input));
      const data = structuredClone(upstream(input));
      if (String(input).includes("period=7d")) data.data.period = "7d";
      return json(data);
    },
  });
  await service.getDashboard("7d");
  await service.getDashboard("30d");
  assert.deepEqual(urls.sort(), [
    "https://api.zecblock.com/v1/network/nodes/history?period=30d",
    "https://api.zecblock.com/v1/network/nodes/history?period=7d",
    "https://api.zecblock.com/v1/network/nodes/stats",
  ]);
});

test("an HTTP failure retains last known good current data while history updates", async () => {
  let clock = 0;
  let fail = false;
  const service = createDashboardService({
    now: () => clock,
    fetch: async (input) => {
      if (fail && !String(input).includes("history"))
        return new Response("", { status: 429 });
      return json(upstream(input));
    },
  });
  const initial = await service.getDashboard("7d");
  clock = 61_000;
  fail = true;
  const result = await service.getDashboard("7d");
  assert.equal(result.current.cached, true);
  assert.match(result.current.error!, /429/);
  assert.deepEqual(result.current.data, initial.current.data);
  assert.equal(result.history.error, null);
  assert.equal(result.history.cached, false);
});

test("history outage does not hide current stats or invent a history array", async () => {
  const service = createDashboardService({
    fetch: async (input) => {
      if (String(input).includes("history")) throw new Error("offline");
      return json(stats);
    },
  });
  const result = await service.getDashboard("7d");
  assert.equal(result.current.data?.total, 467);
  assert.equal(result.current.error, null);
  assert.equal(result.history.data, null);
  assert.ok(result.history.error);
  assert.equal(result.history.cached, false);
});

test("a malformed network response is never cached as successful data", async () => {
  const bad = structuredClone(stats);
  bad.meta.network = "testnet";
  const service = createDashboardService({
    fetch: async (input) =>
      json(String(input).includes("history") ? history : bad),
  });
  const result = await service.getDashboard("7d");
  assert.equal(result.current.data, null);
  assert.match(result.current.error!, /mainnet/);
  assert.equal(result.history.data, null);
  assert.match(result.history.error!, /methodology|contract|confirm/i);
});

test("unversioned history is withheld until the current v3 methodology can be confirmed", async () => {
  const service = createDashboardService({
    fetch: async (input) =>
      String(input).includes("history")
        ? json(upstream(input))
        : new Response("", { status: 503 }),
  });
  const result = await service.getDashboard("7d");
  assert.equal(result.current.data, null);
  assert.equal(result.history.data, null);
  assert.match(result.history.error!, /methodology|contract|confirm/i);
});

test("incompatible current methodology revokes historical comparability even with stale current data", async () => {
  let clock = 0;
  let incompatible = false;
  const service = createDashboardService({
    now: () => clock,
    fetch: async (input) => {
      const raw = structuredClone(upstream(input));
      if (!String(input).includes("history") && incompatible)
        raw.data.stats.censusVersion = 4;
      return json(raw);
    },
  });
  await service.getDashboard("7d");
  clock = 61_000;
  incompatible = true;
  const result = await service.getDashboard("7d");
  assert.equal(result.current.data?.censusVersion, 3);
  assert.equal(result.current.cached, true);
  assert.ok(result.current.error);
  assert.equal(result.history.data, null);
  assert.match(result.history.error!, /methodology|contract|confirm/i);
  incompatible = false;
  const restored = await service.getDashboard("7d");
  assert.equal(restored.history.error, null);
  assert.equal(restored.history.cached, false);
});

test("HTTP429 honors Retry-After while retaining a visible stale-resource error", async () => {
  let clock = 0;
  let limited = false;
  let currentReads = 0;
  const service = createDashboardService({
    now: () => clock,
    fetch: async (input) => {
      if (!String(input).includes("history")) {
        currentReads += 1;
        if (limited)
          return new Response("", {
            status: 429,
            headers: { "retry-after": "120" },
          });
      }
      return json(upstream(input));
    },
  });
  await service.getDashboard("7d");
  limited = true;
  clock = 61_000;
  await service.getDashboard("7d");
  clock = 100_000;
  const backoff = await service.getDashboard("7d");
  assert.equal(currentReads, 2);
  assert.equal(backoff.current.data?.total, 467);
  assert.equal(backoff.current.cached, true);
  assert.match(backoff.current.error!, /429/);
  clock = 181_001;
  limited = false;
  const recovered = await service.getDashboard("7d");
  assert.equal(currentReads, 3);
  assert.equal(recovered.current.error, null);
});

test("each upstream request has a bounded timeout independent of the other resource", async () => {
  let signal: AbortSignal | null | undefined;
  const service = createDashboardService({
    timeoutMs: 20,
    fetch: async (input, init) => {
      if (String(input).includes("history")) {
        signal = init?.signal;
        return new Promise<Response>(() => {});
      }
      return json(stats);
    },
  });
  const result = await service.getDashboard("7d");
  assert.equal(result.current.data?.total, 467);
  assert.equal(result.history.data, null);
  assert.match(result.history.error!, /timed out/i);
  assert.equal(signal?.aborted, true);
});

test("HTTP app rejects arbitrary proxy destinations and serves only built public files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "census-server-"));
  const distDir = join(directory, "dist");
  await mkdir(distDir);
  await writeFile(join(distDir, "index.html"), "<h1>Observatory</h1>");
  await writeFile(join(directory, "secret.txt"), "private");
  await symlink(join(directory, "secret.txt"), join(distDir, "escape.txt"));
  const server = createAppServer({
    distDir,
    fetch: async (input) => json(upstream(input)),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const dashboard = await fetch(`${base}/api/dashboard?period=7d`);
    assert.equal(dashboard.status, 200);
    assert.equal((await dashboard.json()).current.data.total, 467);
    assert.equal(
      (await fetch(`${base}/api/dashboard?period=evil`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${base}/api/dashboard?period=7d&period=30d`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${base}/api/dashboard?url=https://example.com`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${base}/api/dashboard`, { method: "POST" })).status,
      405,
    );
    assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
    assert.equal(
      await (await fetch(`${base}/`)).text(),
      "<h1>Observatory</h1>",
    );
    assert.equal((await fetch(`${base}/escape.txt`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e%2fsecret.txt`)).status, 404);
    assert.equal((await fetch(`${base}/.git/config`)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
