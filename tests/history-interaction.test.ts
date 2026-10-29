import assert from "node:assert/strict";
import test from "node:test";
import { HISTORY_PLOT } from "../src/lib/history.ts";
import {
  historyTimeAtX,
  nearestObservationIndex,
  observationSelectionAtIndex,
  resolveObservationSelection,
} from "../src/lib/historyInteraction.ts";

test("history inspection clamps to existing observation boundaries", () => {
  const times = [100, 200, 500, 1_000];
  assert.equal(nearestObservationIndex(times, -500), 0);
  assert.equal(nearestObservationIndex(times, 1_500), 3);
  assert.equal(nearestObservationIndex(times, 500), 2);
  assert.equal(nearestObservationIndex([200], 10_000), 0);
  assert.equal(nearestObservationIndex([], 100), null);
  assert.equal(nearestObservationIndex(times, Number.NaN), null);
});

test("inspection follows actual timestamps and never invents an observation inside a gap", () => {
  const times = [0, 300_000, 3_600_000, 3_900_000];
  assert.equal(nearestObservationIndex(times, 1_000_000), 1);
  assert.equal(nearestObservationIndex(times, 3_000_000), 2);
  assert.equal(nearestObservationIndex(times, 1_950_000), 1);
  assert.equal(times[nearestObservationIndex(times, 3_000_000)!], 3_600_000);
});

test("plot coordinate inspection uses temporal scale rather than observation index", () => {
  const start = Date.parse("2026-10-20T00:00:00Z");
  const end = start + 3_600_000;
  const middle = (HISTORY_PLOT.left + HISTORY_PLOT.right) / 2;
  assert.equal(historyTimeAtX(HISTORY_PLOT.left, start, end), start);
  assert.equal(historyTimeAtX(HISTORY_PLOT.right, start, end), end);
  assert.equal(historyTimeAtX(middle, start, end), start + 1_800_000);
  assert.equal(historyTimeAtX(-200, start, end), start);
  assert.equal(historyTimeAtX(2_000, start, end), end);
  assert.equal(historyTimeAtX(middle, start, start), start);
  assert.equal(historyTimeAtX(Number.NaN, start, end), null);
  assert.equal(historyTimeAtX(middle, end, start), null);
});

test("equal-time observations remain independently traversable", () => {
  const times = [100, 100, 100, 200];
  for (let index = 0; index < times.length; index += 1) {
    const selection = observationSelectionAtIndex(times, index)!;
    assert.equal(resolveObservationSelection(times, selection), index);
  }
  assert.deepEqual(observationSelectionAtIndex(times, 1), {
    time: 100,
    occurrence: 1,
  });
  assert.equal(observationSelectionAtIndex(times, -1), null);
  assert.equal(observationSelectionAtIndex(times, 4), null);
});

test("duplicate selections reanchor safely after timeline refresh or range changes", () => {
  const selection = observationSelectionAtIndex([100, 100, 200], 1)!;
  assert.equal(resolveObservationSelection([50, 100, 100, 200], selection), 2);
  // Removing an equal-time record clamps to the last surviving occurrence.
  assert.equal(resolveObservationSelection([50, 100, 200], selection), 1);
  // If the timestamp disappears, select one nearest original record.
  assert.equal(resolveObservationSelection([50, 120, 200], selection), 1);
  assert.equal(resolveObservationSelection([200, 300], selection), 0);
  assert.equal(resolveObservationSelection([], selection), null);
});
