import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardViewSearch,
  defaultView,
  parseDashboardView,
  selectCensusRows,
} from "../src/lib/dashboardView.ts";
import type { Census } from "../src/lib/census.ts";

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

test("table and export selection share numeric ordering without changing source shares or rows", () => {
  const rows = [
    { client: "Zebra", version: "3.0", count: 9 },
    { client: "Zakura", version: "1.10", count: 100 },
    { client: "Zakura", version: "1.2", count: 100 },
  ];
  const census: Census = {
    observedAt: "2026-10-29T12:00:00Z",
    total: 209,
    identified: 209,
    coverage: 100,
    countries: null,
    censusVersion: 3,
    scope: "test",
    crawlerNodes: null,
    localPeerNodes: null,
    overlapNodes: null,
    crawlerWindowSeconds: null,
    peerWindowSeconds: null,
    clients: [
      { name: "Zebra", count: 9, share: (9 / 209) * 100 },
      { name: "Zakura", count: 200, share: (200 / 209) * 100 },
    ],
    versions: rows,
  };
  const label = (row: (typeof rows)[number]) => `${row.client}/${row.version}`;
  assert.deepEqual(
    selectCensusRows(census, { ...defaultView, view: "versions" }).versions.map(
      label,
    ),
    ["Zakura/1.2", "Zakura/1.10", "Zebra/3.0"],
  );
  assert.deepEqual(
    selectCensusRows(census, {
      ...defaultView,
      view: "versions",
      sort: "client",
      order: "desc",
    }).versions.map(label),
    ["Zebra/3.0", "Zakura/1.10", "Zakura/1.2"],
  );
  assert.equal(rows[0].client, "Zebra");
  assert.deepEqual(
    selectCensusRows(census, {
      ...defaultView,
      view: "versions",
      client: "Zebra",
    }).versions,
    [rows[0]],
  );
  const selected = selectCensusRows(census, {
    ...defaultView,
    client: "Zakura",
  });
  assert.deepEqual(selected.clients, [census.clients[1]]);
  assert.deepEqual(selected.versions, []);
  assert.equal({ ...census, ...selected }.total, 209);
  assert.equal(selected.clients[0].share, (200 / 209) * 100);
  assert.equal(census.clients.length, 2);
  assert.equal(census.clients[0].name, "Zebra");
  assert.deepEqual(
    selectCensusRows(census, {
      ...defaultView,
      view: "versions",
      client: "Missing",
    }),
    { clients: [], versions: [] },
  );
});
