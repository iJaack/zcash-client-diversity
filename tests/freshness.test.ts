import assert from "node:assert/strict";
import test from "node:test";
import {
  observationFreshness,
  OBSERVATION_DELAY_MS,
} from "../src/lib/freshness.ts";

const observed = "2026-10-29T23:55:00.000Z";
const time = Date.parse(observed);

test("source ages cross the warning threshold without replacing the observation clock", () => {
  assert.deepEqual(observationFreshness(observed, time + 7 * 60_000), {
    ageLabel: "7 min old",
    delayed: false,
    clockSkew: false,
  });
  assert.equal(
    observationFreshness(observed, time + OBSERVATION_DELAY_MS).delayed,
    false,
  );
  assert.equal(
    observationFreshness(observed, time + OBSERVATION_DELAY_MS + 1).delayed,
    true,
  );
  assert.equal(
    observationFreshness(observed, time + 65 * 60_000).ageLabel,
    "1 hr 5 min old",
  );
  assert.equal(
    observationFreshness(observed, time + 2 * 86_400_000).ageLabel,
    "2 days old",
  );
});

test("clock skew and invalid timestamps never pretend to be stale or future negative ages", () => {
  assert.deepEqual(observationFreshness(observed, time - 120_001), {
    ageLabel: "Timestamp ahead of device clock",
    delayed: false,
    clockSkew: true,
  });
  assert.equal(
    observationFreshness(observed, time - 30_000).ageLabel,
    "Less than a minute old",
  );
  assert.deepEqual(observationFreshness("invalid", time), {
    ageLabel: "Age unavailable",
    delayed: false,
    clockSkew: false,
  });
  assert.equal(observationFreshness(observed, NaN).ageLabel, "Age unavailable");
});
