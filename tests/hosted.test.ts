import test from "node:test";
import assert from "node:assert/strict";
import { createHostedDashboardHandler } from "../server/hosted.ts";
import type { DashboardPayload } from "../src/lib/census.ts";

const unavailable: DashboardPayload = {
  current: { data: null, error: "Source unavailable", cached: false },
  history: { data: null, error: "History unavailable", cached: false },
  source: "https://api.zecblock.com/v1/network/nodes/stats",
  fetchedAt: "2026-10-29T18:25:00.000Z",
};

test("hosted handler accepts only fixed periods and read requests", async () => {
  const periods: string[] = [];
  const handler = createHostedDashboardHandler({
    getDashboard: async (period) => {
      periods.push(period);
      return unavailable;
    },
  });
  assert.equal(
    (await handler(new Request("https://zeclens.vercel.app/api/dashboard")))
      .status,
    200,
  );
  assert.equal(
    (
      await handler(
        new Request("https://zeclens.vercel.app/api/dashboard?period=30d"),
      )
    ).status,
    200,
  );
  assert.deepEqual(periods, ["7d", "30d"]);
  for (const query of [
    "period=90d",
    "period=7d&period=30d",
    "url=https://example.com",
    "period=7d&host=evil.test",
  ]) {
    assert.equal(
      (
        await handler(
          new Request(`https://zeclens.vercel.app/api/dashboard?${query}`),
        )
      ).status,
      400,
    );
  }
  const post = await handler(
    new Request("https://zeclens.vercel.app/api/dashboard", { method: "POST" }),
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
  assert.equal(periods.length, 2);
});

test("unavailable source results stay explicit and cannot be cached at the CDN", async () => {
  const handler = createHostedDashboardHandler({
    getDashboard: async () => unavailable,
  });
  const response = await handler(
    new Request("https://zeclens.vercel.app/api/dashboard"),
  );
  assert.deepEqual(await response.json(), unavailable);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
});

test("only fully successful public aggregates receive bounded Vercel CDN caching", async () => {
  const good = {
    ...unavailable,
    current: { data: { total: 1 }, error: null, cached: false },
    history: { data: [], error: null, cached: false },
  } as unknown as DashboardPayload;
  const handler = createHostedDashboardHandler({
    getDashboard: async () => good,
  });
  const response = await handler(
    new Request("https://zeclens.vercel.app/api/dashboard"),
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("vercel-cdn-cache-control"),
    "public, s-maxage=60, stale-while-revalidate=120",
  );
});
