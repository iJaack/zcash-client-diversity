import test from "node:test";
import assert from "node:assert/strict";
import { createBlockTimingService } from "../server/block-timing.ts";
import { previousCompleteUtcDay } from "../src/lib/blockTiming.ts";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");
const DAY = "2026-10-28";
const START = Date.parse(`${DAY}T00:00:00Z`) / 1_000;

function block(
  height: number,
  software = "zebra",
  intervalSeconds: unknown = 30,
) {
  return {
    height,
    hash: height.toString(16).padStart(64, "0"),
    timestamp: START + height,
    software,
    intervalSeconds,
  };
}

function page(
  data: unknown[],
  total = data.length,
  nextCursor: string | null = null,
) {
  return {
    data,
    meta: {
      network: "mainnet",
      indexedHeight: 100,
      page: { limit: 100, total, hasNext: nextCursor !== null, nextCursor },
    },
  };
}

function json(value: unknown): Response {
  return Response.json(value);
}

test("previous complete UTC day includes year and leap-day boundaries", () => {
  assert.equal(previousCompleteUtcDay(NOW), DAY);
  assert.equal(
    previousCompleteUtcDay(Date.parse("2027-01-01T00:00:00Z")),
    "2026-12-31",
  );
  assert.equal(
    previousCompleteUtcDay(Date.parse("2024-03-01T23:59:59Z")),
    "2024-02-29",
  );
});

test("fixed-source cursor reads aggregate actual parent intervals, with signed and unavailable values", async () => {
  const requests: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const noInterval = block(4, "conflicting");
  delete (noInterval as { intervalSeconds?: unknown }).intervalSeconds;
  const pages = [
    page(
      [block(10, "zebra", 12), block(9, "zakura", 100)],
      7,
      "opaque/+?cursor",
    ),
    page(
      [
        block(8, "zebra", 0),
        block(6, "other", null),
        block(5, "unknown", -4),
        noInterval,
        block(3, "missing", null),
      ],
      7,
    ),
  ];
  const firstPage = pages[0];
  const service = createBlockTimingService({
    now: () => NOW,
    fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return json(pages.shift() ?? firstPage);
    },
  });
  const result = await service.getTiming();
  assert.equal(result.error, null);
  assert.equal(result.cached, false);
  const data = result.data!;
  assert.equal(data.day, DAY);
  assert.equal(data.fetchedAt, new Date(NOW).toISOString());
  assert.equal(data.totalBlocks, 7);
  assert.equal(data.timedBlocks, 4);
  assert.equal(data.nonPositiveIntervals, 2);
  assert.equal(data.firstHeight, 3);
  assert.equal(data.lastHeight, 10);
  assert.equal(data.meanSeconds, 27);
  assert.equal(data.medianSeconds, 6);
  assert.equal(data.rows.length, 6);
  assert.deepEqual(
    data.rows.find((row) => row.key === "zebra"),
    {
      key: "zebra",
      name: "Zebra",
      blocks: 2,
      timedBlocks: 2,
      meanSeconds: 6,
      medianSeconds: 6,
      p90Seconds: 10.8,
    },
  );
  assert.deepEqual(
    data.rows.find((row) => row.key === "other"),
    {
      key: "other",
      name: "zcashd",
      blocks: 1,
      timedBlocks: 0,
      meanSeconds: null,
      medianSeconds: null,
      p90Seconds: null,
    },
  );
  assert.equal(data.rows.find((row) => row.key === "unknown")?.meanSeconds, -4);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url.origin, "https://api.zecblock.com");
    assert.equal(request.url.pathname, "/v1/blocks");
    assert.equal(request.url.searchParams.get("software"), "all");
    assert.equal(request.url.searchParams.get("from"), DAY);
    assert.equal(request.url.searchParams.get("to"), DAY);
    assert.equal(request.url.searchParams.get("limit"), "100");
    assert.equal(request.init?.redirect, "error");
    assert.ok(request.init?.signal instanceof AbortSignal);
  }
  assert.equal(requests[0]!.url.searchParams.get("cursor"), null);
  assert.equal(requests[1]!.url.searchParams.get("cursor"), "opaque/+?cursor");
  assert.equal(requests[2]!.url.toString(), requests[0]!.url.toString());
  assert.equal(new URL(data.source).searchParams.get("cursor"), null);
});

test("empty complete indexed samples retain all categories with unavailable statistics", async () => {
  const service = createBlockTimingService({
    now: () => NOW,
    fetch: async () => json(page([])),
  });
  const data = (await service.getTiming()).data!;
  assert.equal(data.totalBlocks, 0);
  assert.equal(data.timedBlocks, 0);
  assert.equal(data.meanSeconds, null);
  assert.equal(data.medianSeconds, null);
  assert.equal(data.firstHeight, null);
  assert.equal(data.lastHeight, null);
  assert.ok(
    data.rows.every(
      (row) =>
        row.blocks === 0 && row.meanSeconds === null && row.p90Seconds === null,
    ),
  );
});

test("schema failures never publish a partial sample", async (t) => {
  const cases: Array<[string, unknown]> = [
    [
      "wrong network",
      { ...page([block(3)]), meta: { ...page([]).meta, network: "testnet" } },
    ],
    ["unknown software", page([block(3, "new-client")])],
    ["string interval", page([block(3, "zebra", "30")])],
    [
      "infinite interval",
      {
        ...page([block(3)]),
        data: [{ ...block(3), intervalSeconds: Infinity }],
      },
    ],
    [
      "millisecond timestamp",
      page([{ ...block(3), timestamp: START * 1_000 }]),
    ],
    ["outside day", page([{ ...block(3), timestamp: START + 86_400 }])],
    ["fractional timestamp", page([{ ...block(3), timestamp: START + 0.5 }])],
    ["bad hash", page([{ ...block(3), hash: "not-a-block-hash" }])],
    ["height beyond index", page([block(101)])],
    ["missing pagination", { data: [block(3)], meta: { network: "mainnet" } }],
    ["explicit truncation", { ...page([block(3)]), truncated: true }],
    [
      "missing cursor",
      {
        ...page([block(3)]),
        meta: {
          ...page([]).meta,
          page: { limit: 100, total: 2, hasNext: true, nextCursor: null },
        },
      },
    ],
    [
      "nonboolean hasNext",
      {
        ...page([block(3)]),
        meta: {
          ...page([]).meta,
          page: { limit: 100, total: 1, hasNext: "false", nextCursor: null },
        },
      },
    ],
    ["truncated final page", page([block(3)], 2)],
    ["extra rows", page([block(3)], 0)],
    ["ascending heights", page([block(2), block(3)])],
    [
      "repeated heights",
      page([block(3), { ...block(3), hash: "a".repeat(64) }]),
    ],
  ];
  for (const [name, payload] of cases) {
    await t.test(name, async () => {
      const service = createBlockTimingService({
        now: () => NOW,
        fetch: async () => {
          // Preserve non-JSON finite-number failures to exercise runtime validation.
          if (name === "infinite interval")
            return { ok: true, json: async () => payload } as Response;
          return json(payload);
        },
      });
      const result = await service.getTiming();
      assert.equal(result.data, null);
      assert.equal(result.cached, false);
      assert.ok(result.error);
    });
  }
});

test("pagination changes, duplicates, cursor loops and page budgets discard every page", async (t) => {
  const cases: Array<[string, unknown[], number | undefined]> = [
    [
      "changed total",
      [page([block(10)], 2, "next"), page([block(9)], 3)],
      undefined,
    ],
    [
      "duplicate hash",
      [
        page([block(10)], 2, "next"),
        page([{ ...block(9), hash: block(10).hash }], 2),
      ],
      undefined,
    ],
    [
      "order changed",
      [page([block(9)], 2, "next"), page([block(10)], 2)],
      undefined,
    ],
    [
      "cursor loop",
      [page([block(10)], 3, "next"), page([block(9)], 3, "next")],
      undefined,
    ],
    ["budget", [page([block(10)], 2, "next")], 1],
    ["empty intermediate page", [page([], 2, "next")], undefined],
  ];
  for (const [name, pages, maxPages] of cases) {
    await t.test(name, async () => {
      let reads = 0;
      const service = createBlockTimingService({
        now: () => NOW,
        maxPages,
        fetch: async () => json(pages[reads++]),
      });
      const result = await service.getTiming();
      assert.equal(result.data, null);
      assert.ok(result.error);
      assert.ok(reads <= 2);
    });
  }
});

test("the default page budget accommodates a 25-second block day", async () => {
  let reads = 0;
  const total = 3_456;
  const service = createBlockTimingService({
    now: () => NOW,
    fetch: async (input) => {
      reads += 1;
      const offset = Number(
        new URL(String(input)).searchParams.get("cursor") ?? "0",
      );
      const size = Math.min(100, total - offset);
      const data = Array.from({ length: size }, (_, index) =>
        block(total - offset - index),
      );
      const payload = page(
        data,
        total,
        offset + size < total ? String(offset + size) : null,
      );
      payload.meta.indexedHeight = total;
      return json(payload);
    },
  });
  assert.equal((await service.getTiming()).data?.totalBlocks, total);
  assert.equal(reads, 36);
});

test("cache coalesces captures, expires, and preserves only last complete data on refresh error", async () => {
  let clock = NOW;
  let reads = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = false;
  const service = createBlockTimingService({
    now: () => clock,
    cacheTtlMs: 100,
    fetch: async () => {
      reads += 1;
      await gate;
      if (fail) return new Response("unavailable", { status: 503 });
      return json(page([block(3)]));
    },
  });
  const first = service.getTiming();
  const second = service.getTiming();
  assert.equal(first, second);
  release!();
  const good = await first;
  assert.equal(good.error, null);
  assert.equal(reads, 2);
  assert.equal((await service.getTiming()).cached, true);
  assert.equal(reads, 2);
  clock += 101;
  fail = true;
  const stale = await service.getTiming();
  assert.equal(stale.cached, true);
  assert.equal(stale.data, good.data);
  assert.match(stale.error!, /HTTP 503/);
  assert.equal(reads, 3);
});

test("Retry-After is honored without serving the previous UTC day's cache after midnight", async () => {
  let clock = Date.parse("2026-10-29T23:59:59.000Z");
  let reads = 0;
  const service = createBlockTimingService({
    now: () => clock,
    cacheTtlMs: 0,
    fetch: async () =>
      ++reads <= 2
        ? json(page([block(3)]))
        : new Response("limited", {
            status: 429,
            headers: { "retry-after": "10" },
          }),
  });
  assert.ok((await service.getTiming()).data);
  const limited = await service.getTiming();
  assert.match(limited.error!, /HTTP 429/);
  assert.equal(limited.cached, true);
  clock += 2_000;
  const nextDay = await service.getTiming();
  assert.equal(nextDay.data, null);
  assert.equal(nextDay.cached, false);
  assert.match(nextDay.error!, /HTTP 429/);
  assert.equal(reads, 3);
  clock += 8_000;
  await service.getTiming();
  assert.equal(reads, 4);
});

test("HTTP-date Retry-After and failed captures are not stored as successful samples", async () => {
  let clock = NOW;
  let reads = 0;
  const service = createBlockTimingService({
    now: () => clock,
    fetch: async () => {
      reads += 1;
      return reads === 1
        ? new Response("limited", {
            status: 429,
            headers: { "retry-after": new Date(NOW + 5_000).toUTCString() },
          })
        : json(page([block(3)]));
    },
  });
  assert.equal((await service.getTiming()).data, null);
  assert.equal((await service.getTiming()).data, null);
  assert.equal(reads, 1);
  clock += 5_000;
  assert.equal((await service.getTiming()).error, null);
  assert.equal(reads, 3);
});

test("a changed first-page anchor discards a same-total capture and preserves only prior complete data", async () => {
  let clock = NOW;
  const oldPage = page([block(5)]);
  const reads = [
    oldPage,
    oldPage,
    page([block(10)], 2, "next"),
    page([block(9)], 2),
    page([block(11)], 2, "next"),
  ];
  const service = createBlockTimingService({
    now: () => clock,
    cacheTtlMs: 100,
    fetch: async () => json(reads.shift()),
  });
  const good = await service.getTiming();
  assert.equal(good.error, null);
  clock += 101;
  const changed = await service.getTiming();
  assert.equal(changed.cached, true);
  assert.equal(changed.data, good.data);
  assert.match(changed.error!, /canonical block anchor changed/);
  assert.equal(reads.length, 0);
});

test("a prior-day capture completing after midnight cannot return old data or clear a new 429 backoff", async () => {
  let clock = Date.parse("2026-10-29T23:59:59.000Z");
  let reads = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = createBlockTimingService({
    now: () => clock,
    fetch: async () => {
      reads += 1;
      if (reads === 1) {
        await gate;
        return json(page([block(3)]));
      }
      return new Response("limited", {
        status: 429,
        headers: { "retry-after": "10" },
      });
    },
  });
  const previousDay = service.getTiming();
  clock += 2_000;
  assert.match((await service.getTiming()).error!, /HTTP 429/);
  release!();
  const crossedMidnight = await previousDay;
  assert.equal(crossedMidnight.data, null);
  assert.equal(crossedMidnight.cached, false);
  assert.match(crossedMidnight.error!, /UTC day changed/);
  assert.match((await service.getTiming()).error!, /HTTP 429/);
  assert.equal(reads, 2);
});

test("deadline covers response bodies and aborts even fetch implementations that ignore their signal", async () => {
  let signal: AbortSignal | undefined;
  const service = createBlockTimingService({
    now: () => NOW,
    timeoutMs: 20,
    fetch: async (_url, init) => {
      signal = init!.signal as AbortSignal;
      return { ok: true, json: () => new Promise(() => {}) } as Response;
    },
  });
  const result = await service.getTiming();
  assert.equal(result.data, null);
  assert.match(result.error!, /timed out/);
  assert.equal(signal?.aborted, true);
});

test("all cursor pages share one deadline", async () => {
  let reads = 0;
  const signals: AbortSignal[] = [];
  const service = createBlockTimingService({
    now: () => NOW,
    timeoutMs: 45,
    fetch: async (_url, init) => {
      reads += 1;
      signals.push(init!.signal as AbortSignal);
      await new Promise((resolve) => setTimeout(resolve, 30));
      return json(page([block(10 - reads)], 3, `cursor-${reads}`));
    },
  });
  const result = await service.getTiming();
  assert.equal(result.data, null);
  assert.match(result.error!, /timed out/);
  assert.ok(reads <= 2);
  assert.equal(signals.at(-1)?.aborted, true);
});

test("the anchor reread shares the capture deadline", async () => {
  let reads = 0;
  const service = createBlockTimingService({
    now: () => NOW,
    timeoutMs: 45,
    fetch: async () => {
      reads += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return json(page([block(3)]));
    },
  });
  const result = await service.getTiming();
  assert.equal(reads, 2);
  assert.equal(result.data, null);
  assert.match(result.error!, /timed out/);
});
