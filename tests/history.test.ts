import assert from "node:assert/strict";
import test from "node:test";
import type { HistoryPoint } from "../src/lib/census.ts";
import {
  buildLinePaths,
  historyCsv,
  HISTORY_PLOT,
  HISTORY_SOURCE_URL,
  MAX_SERIES_POINTS,
} from "../src/lib/history.ts";

const origin = Date.parse("2026-10-20T00:00:00Z");
function point(minutes: number, share = 50, censusVersion = 2): HistoryPoint {
  return {
    at: new Date(origin + minutes * 60_000).toISOString(),
    total: 100,
    censusVersion,
    clients: [{ name: "Zebra", count: share, share }],
  };
}

test("uses actual temporal positions and a fixed percent scale", () => {
  const result = buildLinePaths([point(0, 0), point(5, 25), point(15, 100)]);
  const coordinates = result.series[0].segments[0];
  assert.equal(coordinates[0].y, HISTORY_PLOT.bottom);
  assert.equal(coordinates[2].y, HISTORY_PLOT.top);
  assert.ok(
    Math.abs(
      coordinates[1].x -
        (HISTORY_PLOT.left + (HISTORY_PLOT.right - HISTORY_PLOT.left) / 3),
    ) < 1e-9,
  );
});

test("does not bridge long gaps, census changes, absent clients, or undefined shares", () => {
  const absent = { ...point(40), clients: [] };
  const noDenominator = { ...point(50), total: 0 };
  const result = buildLinePaths([
    point(0),
    point(5),
    point(25),
    point(30, 60, 3),
    point(35, 60, 3),
    { ...absent, censusVersion: 3 },
    point(45, 65, 3),
    { ...noDenominator, censusVersion: 3 },
    point(55, 70, 3),
  ]);
  assert.deepEqual(
    result.series[0].segments.map((segment) =>
      segment.map((sample) => (sample.time - origin) / 60_000),
    ),
    [[0, 5], [25], [30, 35], [45], [55]],
  );
});

test("missing latest client remains unavailable rather than becoming zero", () => {
  const latest = {
    ...point(10),
    clients: [{ name: "New client", count: 100, share: 100 }],
  };
  const result = buildLinePaths([point(0), point(5), latest]);
  assert.equal(
    result.series.find((series) => series.name === "Zebra")?.latestShare,
    null,
  );
  assert.equal(
    result.series.find((series) => series.name === "New client")?.latestShare,
    100,
  );
});

test("sampling remains bounded and preserves segment endpoints and boundaries", () => {
  const first = Array.from({ length: 2_000 }, (_, index) =>
    point(index * 5, index % 100),
  );
  const second = Array.from({ length: 2_000 }, (_, index) =>
    point(11_000 + index * 5, 100 - (index % 100), 3),
  );
  const series = buildLinePaths([...first, ...second]).series[0];
  assert.equal(series.plottedPointCount, MAX_SERIES_POINTS);
  assert.equal(series.segments.length, 2);
  assert.deepEqual(
    series.segments.map((segment) => [segment[0].time, segment.at(-1)!.time]),
    [
      [Date.parse(first[0].at), Date.parse(first.at(-1)!.at)],
      [Date.parse(second[0].at), Date.parse(second.at(-1)!.at)],
    ],
  );
  assert.equal(series.paths.length, 2);
});

test("extremely fragmented data stays bounded without connecting across interruptions", () => {
  const points = Array.from({ length: 2_000 }, (_, index) => point(index * 20));
  const series = buildLinePaths(points).series[0];
  assert.equal(series.plottedPointCount, MAX_SERIES_POINTS);
  assert.ok(series.segments.every((segment) => segment.length === 1));
  assert.equal(series.segments.at(-1)![0].time, Date.parse(points.at(-1)!.at));
});

test("sampling retains a brief large change inside a dense series", () => {
  const points = Array.from({ length: 4_000 }, (_, index) =>
    point(index * 5, index === 2_000 ? 100 : 20),
  );
  const series = buildLinePaths(points, 100).series[0];
  assert.equal(series.plottedPointCount, 100);
  assert.ok(series.segments[0].some((sample) => sample.share === 100));
});

test("full history CSV retains every observation, gap, share, and census boundary", () => {
  const points = Array.from({ length: 2_000 }, (_, index) =>
    point(index * 20, index % 100, index < 1_000 ? 2 : 3),
  );
  const csv = historyCsv(points);
  const rows = csv.trimEnd().split("\r\n");
  assert.equal(rows.length, points.length + 1);
  assert.equal(
    rows[1],
    `"${points[0].at}","Zebra","0","0","100","2","${HISTORY_SOURCE_URL}"`,
  );
  assert.equal(
    rows.at(-1),
    `"${points.at(-1)!.at}","Zebra","99","99","100","3","${HISTORY_SOURCE_URL}"`,
  );
  assert.equal(
    csv.match(/https:\/\/api\.zecblock\.com\/v1\/network\/nodes\/history/g)
      ?.length,
    points.length,
  );
});

test("history CSV neutralizes formula labels and quotes commas, quotes, and newlines", () => {
  const names = [
    "=SUM(1,2)",
    " +CMD",
    "-1+1",
    "@formula",
    "\uFEFF  =formula",
    "\tformula",
    'A "quoted",\nclient',
  ];
  const observation = {
    ...point(0),
    clients: names.map((name) => ({ name, count: 1, share: 1 })),
  };
  const csv = historyCsv([observation]);
  for (const name of names.slice(0, -1)) {
    assert.ok(
      csv.includes(`"'${name.replaceAll('"', '""')}"`),
      `unsafe label: ${JSON.stringify(name)}`,
    );
  }
  assert.ok(csv.includes('"A ""quoted"",\nclient"'));
});

test("history CSV leaves an undefined zero-total share blank", () => {
  const observation = { ...point(0, 0), total: 0 };
  assert.ok(historyCsv([observation]).includes('"Zebra","0","","0"'));
  const empty = { ...observation, clients: [] };
  assert.ok(
    historyCsv([empty]).includes(
      `"${empty.at}","","","","0","2","${HISTORY_SOURCE_URL}"`,
    ),
  );
});
