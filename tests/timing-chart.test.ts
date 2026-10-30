import assert from "node:assert/strict";
import test from "node:test";
import { intervalBarLayout } from "../src/lib/timingChart.ts";

test("interval chart preserves a shared zero and signs instead of ranking clients", () => {
  const layout = intervalBarLayout([-10, 0, 30, null]);
  assert.equal(layout.minimum, -10);
  assert.equal(layout.maximum, 30);
  assert.equal(layout.zero, 25);
  assert.deepEqual(layout.bars, [
    { left: 0, width: 25 },
    { left: 25, width: 0 },
    { left: 25, width: 75 },
    null,
  ]);
});

test("zero is a measured marker while unavailable intervals have no bar", () => {
  assert.deepEqual(intervalBarLayout([0, null]).bars, [
    { left: 0, width: 0 },
    null,
  ]);
  assert.deepEqual(intervalBarLayout([null, null]).bars, [null, null]);
  assert.equal(intervalBarLayout([-8, -4]).zero, 100);
});

test("finite interval extremes do not overflow the chart scale", () => {
  const layout = intervalBarLayout([-Number.MAX_VALUE, Number.MAX_VALUE]);
  assert.equal(layout.zero, 50);
  assert.deepEqual(layout.bars, [
    { left: 0, width: 50 },
    { left: 50, width: 50 },
  ]);
});
