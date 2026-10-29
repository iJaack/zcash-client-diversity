import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardViewSearch,
  defaultView,
  parseDashboardView,
  sortClientRows,
} from "../src/lib/dashboardView.ts";

test("shared views round-trip grouping, range, client and numeric sort", () => {
  const view = {
    period: "30d",
    view: "versions",
    client: "New client / v2 + beta",
    sort: "client",
    order: "asc",
    metric: "p90",
  } as const;
  assert.deepEqual(parseDashboardView(dashboardViewSearch(view)), view);
  assert.equal(dashboardViewSearch(defaultView), "");
});

test("invalid URL values fall back safely without excluding new client names", () => {
  assert.deepEqual(
    parseDashboardView(
      "?period=forever&view=other&client=%00bad&sort=share&order=random",
    ),
    defaultView,
  );
  assert.equal(parseDashboardView(`?client=${"x".repeat(1001)}`).client, "all");
  assert.equal(
    parseDashboardView("?client=%20New%20client%20").client,
    "New client",
  );
});

test("client sorting is numeric, stable for equal counts and leaves source rows untouched", () => {
  const rows = [
    { client: "Zebra", version: "3.0", count: 9 },
    { client: "Zakura", version: "1.10", count: 100 },
    { client: "Zakura", version: "1.2", count: 100 },
  ];
  const label = (row: (typeof rows)[number]) => `${row.client}/${row.version}`;
  assert.deepEqual(sortClientRows(rows, label, "nodes", "desc").map(label), [
    "Zakura/1.2",
    "Zakura/1.10",
    "Zebra/3.0",
  ]);
  assert.deepEqual(sortClientRows(rows, label, "client", "desc").map(label), [
    "Zebra/3.0",
    "Zakura/1.10",
    "Zakura/1.2",
  ]);
  assert.equal(rows[0].client, "Zebra");
});
