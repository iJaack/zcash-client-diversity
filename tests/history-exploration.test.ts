import assert from "node:assert/strict";
import test from "node:test";
import type { HistoryPoint } from "../src/lib/census.ts";
import {
  compareObservations,
  historyWindow,
  resolvePinnedObservation,
} from "../src/lib/historyExploration.ts";

const point = (hour: number, count = 40, total = 100): HistoryPoint => ({
  at: new Date(Date.UTC(2026, 9, 20, hour)).toISOString(),
  total,
  clients: [
    { name: "Zebra", count, share: total ? (count / total) * 100 : 0 },
    {
      name: "Zakura",
      count: total - count,
      share: total ? ((total - count) / total) * 100 : 0,
    },
  ],
  censusVersion: 3,
});

test("history zoom uses the latest recorded time, includes boundaries and duplicates, and does not mutate source", () => {
  const source = [point(48), point(42), point(24), point(0), point(42, 30)];
  const original = structuredClone(source);
  assert.deepEqual(historyWindow(source, "6h"), [
    source[1],
    source[4],
    source[0],
  ]);
  assert.deepEqual(historyWindow(source, "24h"), [
    source[2],
    source[1],
    source[4],
    source[0],
  ]);
  assert.equal(historyWindow(source, "full").length, 5);
  assert.deepEqual(source, original);
  assert.deepEqual(historyWindow([], "6h"), []);
  assert.deepEqual(historyWindow([{ ...point(0), at: "invalid" }], "24h"), []);
});

test("zoom retains actual gaps and empty observations without manufacturing samples", () => {
  const source = [point(0), { ...point(23), total: 0, clients: [] }, point(24)];
  assert.deepEqual(historyWindow(source, "24h"), source);
  assert.deepEqual(historyWindow(source, "6h"), source.slice(1));
});

test("pinned source records survive refresh and row reorder but not removal or revision", () => {
  const pinned = point(24);
  const refreshed = {
    ...structuredClone(pinned),
    clients: [...pinned.clients].reverse(),
  };
  assert.equal(
    resolvePinnedObservation([point(0), refreshed, point(48)], pinned),
    refreshed,
  );
  assert.equal(
    resolvePinnedObservation([point(24, 50), point(48)], pinned),
    null,
  );
  assert.equal(resolvePinnedObservation([point(48)], pinned), null);
  assert.equal(resolvePinnedObservation([pinned], null), null);
  assert.equal(
    resolvePinnedObservation([{ ...pinned, censusVersion: 4 }], pinned),
    null,
  );
  // Distinct records at the same time do not silently replace the pinned values.
  assert.equal(
    resolvePinnedObservation([point(24, 20), refreshed], pinned),
    refreshed,
  );
});

test("comparison uses each observation's full denominator and reports percentage points", () => {
  const comparison = compareObservations(point(0, 40, 100), point(1, 60, 200));
  assert.equal(comparison.reason, null);
  assert.deepEqual(comparison.rows, [
    { name: "Zebra", countChange: 20, shareChange: -10 },
    { name: "Zakura", countChange: 80, shareChange: 10 },
  ]);
  assert.deepEqual(
    compareObservations(point(0), point(0)).rows.map((row) => row.countChange),
    [0, 0],
  );
});

test("comparison never treats missing categories, empty populations or changed census methods as measured changes", () => {
  const before = point(0);
  const missing = {
    ...point(1),
    clients: [{ name: "New client", count: 100, share: 100 }],
  };
  assert(
    compareObservations(before, missing).rows.every(
      (row) => row.countChange === null && row.shareChange === null,
    ),
  );
  for (const after of [point(1, 0, 0), { ...point(1), censusVersion: 4 }]) {
    const comparison = compareObservations(before, after);
    assert(comparison.reason);
    assert(
      comparison.rows.every(
        (row) => row.countChange === null && row.shareChange === null,
      ),
    );
  }
  const measuredZero = point(1, 0);
  assert.equal(
    compareObservations(before, measuredZero).rows[0].countChange,
    -40,
  );
});
