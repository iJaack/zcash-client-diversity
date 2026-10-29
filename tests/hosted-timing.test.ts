import test from "node:test";
import assert from "node:assert/strict";
import { createHostedTimingHandler } from "../server/hosted-timing.ts";
import type { BlockTiming } from "../src/lib/blockTiming.ts";
import type { Resource } from "../src/lib/census.ts";

const unavailable: Resource<BlockTiming> = {
  data: null,
  error: "Source unavailable",
  cached: false,
};
const NOW = Date.parse("2026-10-29T12:00:00.000Z");

test("hosted timing accepts GET only and rejects every query parameter", async () => {
  let calls = 0;
  const handler = createHostedTimingHandler({
    getTiming: async () => {
      calls += 1;
      return unavailable;
    },
  });
  assert.equal(
    (await handler(new Request("https://zeclens.vercel.app/api/block-timing")))
      .status,
    200,
  );
  for (const query of [
    "day=2026-10-28",
    "software=zebra",
    "url=https://example.com",
    "period=7d",
    "cursor=x",
    "unused=",
  ]) {
    const response = await handler(
      new Request(`https://zeclens.vercel.app/api/block-timing?${query}`),
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
  }
  for (const method of ["POST", "HEAD", "PUT"]) {
    const response = await handler(
      new Request("https://zeclens.vercel.app/api/block-timing", { method }),
    );
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET");
  }
  assert.equal(calls, 1);
});

test("explicit source errors and stale data return 200 without CDN caching", async () => {
  for (const payload of [
    unavailable,
    {
      ...unavailable,
      data: { day: "2026-10-28" } as BlockTiming,
      cached: true,
    },
  ]) {
    const handler = createHostedTimingHandler({
      getTiming: async () => payload,
    });
    const response = await handler(
      new Request("https://zeclens.vercel.app/api/block-timing"),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), payload);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
  }
});

test("successful timing gets five-minute shared caching and browser no-store", async () => {
  const payload = {
    data: { day: "2026-10-28" } as BlockTiming,
    error: null,
    cached: false,
  };
  const handler = createHostedTimingHandler(
    { getTiming: async () => payload },
    () => NOW,
  );
  const response = await handler(
    new Request("https://zeclens.vercel.app/api/block-timing"),
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("vercel-cdn-cache-control"),
    "public, s-maxage=300",
  );
  assert.deepEqual(await response.json(), payload);
});

test("shared caching expires at UTC midnight and excludes a previous selected day", async () => {
  const payload = {
    data: { day: "2026-10-28" } as BlockTiming,
    error: null,
    cached: false,
  };
  for (const [at, expected] of [
    ["2026-10-29T23:59:30.000Z", "public, s-maxage=30"],
    ["2026-10-29T23:59:59.500Z", null],
    ["2026-10-30T00:00:00.000Z", null],
  ] as const) {
    const handler = createHostedTimingHandler(
      { getTiming: async () => payload },
      () => Date.parse(at),
    );
    const response = await handler(
      new Request("https://zeclens.vercel.app/api/block-timing"),
    );
    assert.equal(response.headers.get("vercel-cdn-cache-control"), expected);
  }
});

test("unexpected service failures return a generic 500 without cache headers", async () => {
  const original = console.error;
  const errors: unknown[][] = [];
  console.error = (...items: unknown[]) => {
    errors.push(items);
  };
  try {
    const handler = createHostedTimingHandler({
      getTiming: async () => {
        throw new Error("internal failure");
      },
    });
    const response = await handler(
      new Request("https://zeclens.vercel.app/api/block-timing"),
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Unable to load block timing.",
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
    assert.equal(errors.length, 1);
  } finally {
    console.error = original;
  }
});
