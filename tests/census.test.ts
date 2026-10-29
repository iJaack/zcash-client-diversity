import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  csvForCensus,
  normalizeHistory,
  normalizeStats,
} from "../src/lib/census.ts";

const stats = () =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/zecblock-stats.json", import.meta.url),
      "utf8",
    ),
  );
const history = () =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/zecblock-history.json", import.meta.url),
      "utf8",
    ),
  );

test("current shares use all observed IPs including unknowns and seeders", () => {
  const result = normalizeStats(stats());
  assert.equal(result.total, 467);
  assert.equal(result.identified, 465);
  assert.equal(result.observedAt, "2026-10-29T18:10:01.111Z");
  assert.ok(Math.abs(result.coverage - 99.57173447537473) < 1e-10);
  assert.ok(
    Math.abs(
      result.clients.find((row) => row.name === "Zebra")!.share -
        67.88008565310492,
    ) < 1e-10,
  );
  assert.deepEqual(
    result.clients.map((row) => row.name),
    ["Zebra", "Zakura", "Seeder", "Unknown"],
  );
  assert.equal(result.versions.length, 12);
  assert.equal(result.crawlerNodes, 50);
  assert.equal(result.localPeerNodes, 451);
  assert.equal(result.overlapNodes, 34);
});

test("novel client names survive normalization", () => {
  const raw = stats();
  raw.data.clients.distribution[0].count -= 1;
  raw.data.clients.distribution.push({ client: "New Client", count: 1 });
  assert.equal(
    normalizeStats(raw).clients.find((row) => row.name === "New Client")?.count,
    1,
  );
});

test("invalid current payloads never become zero measurements", () => {
  const mutations: Array<(raw: ReturnType<typeof stats>) => unknown> = [
    () => null,
    (raw) => {
      raw.meta.network = "testnet";
      return raw;
    },
    (raw) => {
      delete raw.meta;
      return raw;
    },
    (raw) => {
      raw.data.clients = null;
      return raw;
    },
    (raw) => {
      raw.data.stats.lastUpdated = null;
      return raw;
    },
    (raw) => {
      raw.data.stats.lastUpdated = "not-a-date";
      return raw;
    },
    (raw) => {
      raw.data.stats.censusVersion = 2;
      return raw;
    },
    (raw) => {
      raw.data.stats.scope = "all-historical-candidate-ips";
      return raw;
    },
    (raw) => {
      raw.data.clients.observedNodes = null;
      return raw;
    },
    (raw) => {
      raw.data.clients.distribution[0].count = -1;
      return raw;
    },
    (raw) => {
      raw.data.clients.distribution[0].count = 1.5;
      return raw;
    },
    (raw) => {
      raw.data.clients.distribution[0].count = "317";
      return raw;
    },
    (raw) => {
      raw.data.clients.distribution[0].count += 1;
      return raw;
    },
    (raw) => {
      raw.data.stats.activeNodes += 1;
      return raw;
    },
    (raw) => {
      raw.data.clients.identifiedNodes = 468;
      return raw;
    },
    (raw) => {
      raw.data.clients.coveragePercentage = 12;
      return raw;
    },
    (raw) => {
      raw.data.clients.distribution.push({ client: "Zebra", count: 0 });
      return raw;
    },
    (raw) => {
      raw.data.clients.versions[0].count = -1;
      return raw;
    },
    (raw) => {
      raw.data.clients.versions[0].count = 468;
      return raw;
    },
    (raw) => {
      raw.data.stats.countries = 1.2;
      return raw;
    },
    (raw) => {
      raw.data.stats.overlapNodes = 52;
      return raw;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    assert.throws(
      () => normalizeStats(mutate(stats())),
      `invalid current case ${index}`,
    );
  }
});

test("missing optional geography and provenance remain unknown", () => {
  const raw = stats();
  delete raw.data.stats.countries;
  delete raw.data.stats.chainQualifiedCrawlerNodes;
  delete raw.data.stats.localPeerNodes;
  delete raw.data.stats.overlapNodes;
  const result = normalizeStats(raw);
  assert.equal(result.countries, null);
  assert.equal(result.crawlerNodes, null);
  assert.equal(result.localPeerNodes, null);
});

test("a genuine empty census has finite percentages", () => {
  const raw = stats();
  Object.assign(raw.data.stats, {
    activeNodes: 0,
    chainQualifiedCrawlerNodes: 0,
    localPeerNodes: 0,
    overlapNodes: 0,
  });
  Object.assign(raw.data.clients, {
    observedNodes: 0,
    identifiedNodes: 0,
    coveragePercentage: 0,
    distribution: [],
    versions: [],
  });
  const result = normalizeStats(raw);
  assert.equal(result.total, 0);
  assert.equal(result.coverage, 0);
  assert.deepEqual(result.clients, []);
});

test("fixed-provider history applies verified v3 source filter and full denominator", () => {
  const result = normalizeHistory(history());
  assert.equal(result.length, 3);
  assert.equal(result[0].at, "2026-10-19T11:30:02.935Z");
  assert.equal(result[0].censusVersion, 3);
  assert.equal(result[2].total, 467);
  assert.equal(
    result[2].clients.find((row) => row.name === "Unknown")?.count,
    2,
  );
  assert.ok(
    Math.abs(
      result[2].clients.find((row) => row.name === "Zebra")!.share -
        67.88008565310492,
    ) < 1e-10,
  );
});

test("history excludes explicit older census versions and preserves gaps", () => {
  const raw = history();
  raw.data.snapshots[1].censusVersion = 2;
  raw.data.snapshots.reverse();
  const result = normalizeHistory(raw);
  assert.deepEqual(
    result.map((row) => row.at),
    ["2026-10-19T11:30:02.935Z", "2026-10-29T18:10:01.392Z"],
  );
});

test("an omitted category in a validated complete history distribution is measured zero", () => {
  const raw = history();
  delete raw.data.snapshots[0].clientCounts.Seeder;
  raw.data.snapshots[0].clientCounts.Zebra = 304;
  const result = normalizeHistory(raw);
  assert.deepEqual(
    result[0].clients.find((row) => row.name === "Seeder"),
    { name: "Seeder", count: 0, share: 0 },
  );
  assert.equal(
    result[1].clients.find((row) => row.name === "Seeder")?.count,
    4,
  );
});

test("invalid history is unavailable instead of producing invented shares", () => {
  const mutations: Array<(raw: ReturnType<typeof history>) => unknown> = [
    () => null,
    (raw) => {
      raw.meta.network = "testnet";
      return raw;
    },
    (raw) => {
      raw.data.snapshots = null;
      return raw;
    },
    (raw) => {
      raw.data.period = "all";
      return raw;
    },
    (raw) => {
      raw.data.snapshots[0].clientCounts = null;
      return raw;
    },
    (raw) => {
      raw.data.snapshots[0].clientCounts.Zebra = -1;
      return raw;
    },
    (raw) => {
      raw.data.snapshots[0].clientCounts.Zebra = 1.5;
      return raw;
    },
    (raw) => {
      raw.data.snapshots[0].activeNodes += 1;
      return raw;
    },
    (raw) => {
      raw.data.snapshots[0].time = "invalid";
      return raw;
    },
    (raw) => {
      raw.data.snapshots[0].censusVersion = null;
      return raw;
    },
    (raw) => {
      raw.data.snapshots.push(raw.data.snapshots[0]);
      return raw;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    assert.throws(
      () => normalizeHistory(mutate(history())),
      `invalid history case ${index}`,
    );
  }
  const empty = history();
  empty.data.snapshots = [];
  assert.deepEqual(normalizeHistory(empty), []);
});

test("CSV identifies the observation/source and quotes cells against formulas", () => {
  const census = normalizeStats(stats());
  census.clients = [{ name: ' =HYPERLINK("evil", "x")', count: 1, share: 0.2 }];
  census.versions = [{ client: "@name", version: '1,2"3', count: 1 }];
  const csv = csvForCensus(census);
  assert.match(csv, /observed_at/);
  assert.match(csv, /2026-10-29T18:10:01.111Z/);
  assert.match(csv, /https:\/\/api.zecblock.com\/v1\/network\/nodes\/stats/);
  assert.ok(csv.includes('"\' =HYPERLINK(""evil"", ""x"")"'));
  assert.ok(csv.includes('"\'@name"'));
  assert.ok(csv.includes('"1,2""3"'));
  assert.ok(csv.includes('"version_top_12"'));
  assert.ok(csv.endsWith("\r\n"));
});
