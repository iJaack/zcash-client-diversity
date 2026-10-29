/** The source is fixed; neither browser queries nor CSV cells can choose a host. */
export const CENSUS_SOURCE_URL =
  "https://api.zecblock.com/v1/network/nodes/stats";
export const CENSUS_SCOPE = "live-peers-and-chain-qualified-crawler-unique-ips";

export interface ClientRow {
  name: string;
  count: number;
  share: number;
}
export interface VersionRow {
  client: string;
  version: string;
  count: number;
}
export interface Census {
  observedAt: string;
  total: number;
  identified: number;
  /** Percent of the full observed population, in [0, 100]. */
  coverage: number;
  countries: number | null;
  clients: ClientRow[];
  versions: VersionRow[];
  censusVersion: number;
  scope: string;
  crawlerNodes: number | null;
  localPeerNodes: number | null;
  overlapNodes: number | null;
  crawlerWindowSeconds: number | null;
  peerWindowSeconds: number | null;
}
export interface HistoryPoint {
  at: string;
  total: number;
  clients: ClientRow[];
  censusVersion: number;
}
export interface Resource<T> {
  data: T | null;
  error: string | null;
  cached: boolean;
}
export interface DashboardPayload {
  current: Resource<Census>;
  history: Resource<HistoryPoint[]>;
  fetchedAt: string;
  source: string;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${field}: expected an object.`);
  return value as Record<string, unknown>;
}

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${field}: expected a nonnegative integer.`);
  }
  return value;
}

function optionalCount(value: unknown, field: string): number | null {
  return value === undefined || value === null ? null : count(value, field);
}

function label(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 1_000)
    throw new Error(`Invalid ${field}: expected a nonempty string.`);
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    throw new Error(`Invalid ${field}: expected an observation timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds))
    throw new Error(`Invalid ${field}: invalid date.`);
  return new Date(milliseconds).toISOString();
}

function envelope(raw: unknown): Record<string, unknown> {
  const root = object(raw, "response");
  const meta = object(root.meta, "meta");
  if (meta.network !== "mainnet")
    throw new Error("ZecBlock response is not confirmed mainnet.");
  return object(root.data, "data");
}

function clientRows(
  entries: Array<[string, unknown]>,
  total: number,
): ClientRow[] {
  const names = new Set<string>();
  let sum = 0;
  const rows = entries.map(([name, value]) => {
    label(name, "client");
    if (names.has(name))
      throw new Error(`Duplicate client in distribution: ${name}.`);
    names.add(name);
    const size = count(value, `count for ${name}`);
    sum += size;
    return { name, count: size, share: total === 0 ? 0 : (size / total) * 100 };
  });
  if (!Number.isSafeInteger(sum) || sum !== total)
    throw new Error(
      "Client counts do not sum to the full observed population.",
    );
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function checkIdentified(
  identified: number,
  total: number,
  clients: ClientRow[],
): void {
  const unknown = clients.find((row) => row.name === "Unknown")?.count ?? 0;
  if (identified > total || identified !== total - unknown)
    throw new Error(
      "Identified nodes disagree with the observed population and Unknown count.",
    );
}

export function normalizeStats(raw: unknown): Census {
  const data = envelope(raw);
  const stats = object(data.stats, "stats");
  const source = object(data.clients, "clients");
  const censusVersion = count(stats.censusVersion, "censusVersion");
  if (censusVersion !== 3 || stats.scope !== CENSUS_SCOPE)
    throw new Error(
      "Unsupported census methodology; expected the mainnet v3 unique-IP census.",
    );
  const total = count(source.observedNodes, "observedNodes");
  if (count(stats.activeNodes, "activeNodes") !== total)
    throw new Error("Active and observed node denominators disagree.");
  if (!Array.isArray(source.distribution))
    throw new Error("Invalid client distribution.");
  const clients = clientRows(
    source.distribution.map((value) => {
      const row = object(value, "distribution row");
      return [label(row.client, "client"), row.count];
    }),
    total,
  );
  const identified = count(source.identifiedNodes, "identifiedNodes");
  checkIdentified(identified, total, clients);
  const coverage = total === 0 ? 0 : (identified / total) * 100;
  const reportedCoverage = source.coveragePercentage;
  if (
    typeof reportedCoverage !== "number" ||
    !Number.isFinite(reportedCoverage) ||
    reportedCoverage < 0 ||
    reportedCoverage > 100 ||
    Math.abs(reportedCoverage - coverage) > 0.051
  ) {
    throw new Error(
      "Reported coverage disagrees with the observed and identified counts.",
    );
  }
  if (!Array.isArray(source.versions))
    throw new Error("Invalid versions list.");
  const seenVersions = new Set<string>();
  const versionTotals = new Map<string, number>();
  const versions = source.versions.map((value) => {
    const row = object(value, "version row");
    const client = label(row.client, "version client");
    const version = label(row.version, "version");
    const size = count(row.count, "version count");
    const key = JSON.stringify([client, version]);
    if (seenVersions.has(key)) throw new Error("Duplicate client version.");
    seenVersions.add(key);
    const versionTotal = (versionTotals.get(client) ?? 0) + size;
    const clientTotal = clients.find((item) => item.name === client)?.count;
    if (clientTotal === undefined || versionTotal > clientTotal)
      throw new Error(
        "Version counts exceed the corresponding client population.",
      );
    versionTotals.set(client, versionTotal);
    return { client, version, count: size };
  });
  const crawlerNodes = optionalCount(
    stats.chainQualifiedCrawlerNodes,
    "chainQualifiedCrawlerNodes",
  );
  const localPeerNodes = optionalCount(stats.localPeerNodes, "localPeerNodes");
  const overlapNodes = optionalCount(stats.overlapNodes, "overlapNodes");
  if (
    (crawlerNodes !== null && crawlerNodes > total) ||
    (localPeerNodes !== null && localPeerNodes > total) ||
    (overlapNodes !== null &&
      (overlapNodes > total ||
        (crawlerNodes !== null && overlapNodes > crawlerNodes) ||
        (localPeerNodes !== null && overlapNodes > localPeerNodes)))
  ) {
    throw new Error("Census provenance counts exceed the observed population.");
  }
  if (
    crawlerNodes !== null &&
    localPeerNodes !== null &&
    overlapNodes !== null &&
    crawlerNodes + localPeerNodes - overlapNodes !== total
  ) {
    throw new Error(
      "Crawler/peer union disagrees with the observed population.",
    );
  }
  return {
    observedAt: timestamp(stats.lastUpdated, "lastUpdated"),
    total,
    identified,
    coverage,
    countries: optionalCount(stats.countries, "countries"),
    clients,
    versions,
    censusVersion,
    scope: CENSUS_SCOPE,
    crawlerNodes,
    localPeerNodes,
    overlapNodes,
    crawlerWindowSeconds: optionalCount(
      stats.observationWindowSeconds,
      "observationWindowSeconds",
    ),
    peerWindowSeconds: optionalCount(
      stats.peerObservationWindowSeconds,
      "peerObservationWindowSeconds",
    ),
  };
}

/**
 * Adapter for the fixed ZecBlock v1 mainnet history endpoint, not arbitrary data.
 * Individual points omit censusVersion. The reviewed source applies
 * `AND census_version = 3` to crawl-mode history SQL; see docs/API-SOURCES.md
 * and Kenbak/zecblock@68bc0676db14214c533c4317bf5e3f36257c13c6,
 * server/api/routes/network.js SNAPSHOT_FILTER and /nodes/history.
 */
export function normalizeHistory(raw: unknown): HistoryPoint[] {
  const data = envelope(raw);
  if (data.period !== "7d" && data.period !== "30d")
    throw new Error("Unsupported history period.");
  if (!Array.isArray(data.snapshots))
    throw new Error("Invalid history snapshots.");
  const times = new Set<string>();
  const points: HistoryPoint[] = [];
  for (const value of data.snapshots) {
    const row = object(value, "history snapshot");
    const censusVersion =
      row.censusVersion === undefined
        ? 3
        : count(row.censusVersion, "history censusVersion");
    if (censusVersion !== 3) continue;
    const at = timestamp(row.time, "history time");
    if (times.has(at))
      throw new Error("Duplicate history observation timestamp.");
    times.add(at);
    const total = count(row.activeNodes, "history activeNodes");
    const clients = clientRows(
      Object.entries(object(row.clientCounts, "history clientCounts")),
      total,
    );
    checkIdentified(
      count(row.identifiedClientNodes, "history identifiedClientNodes"),
      total,
      clients,
    );
    points.push({ at, total, clients, censusVersion });
  }
  // These are complete distributions (their sums were checked), so omitted
  // categories are measured zero. Missing snapshots still remain time gaps.
  const names = [
    ...new Set(
      points.flatMap((point) => point.clients.map((client) => client.name)),
    ),
  ];
  for (const point of points) {
    const present = new Set(point.clients.map((client) => client.name));
    for (const name of names)
      if (!present.has(name)) point.clients.push({ name, count: 0, share: 0 });
  }
  return points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function csvCell(value: string | number): string {
  let cell = String(value);
  // Quoting alone does not prevent spreadsheet formula execution.
  if (/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

/** Callers can select the visible rows before export, retaining census metadata. */
export function csvForCensus(census: Census): string {
  const rows: Array<Array<string | number>> = [
    [
      "record_type",
      "observed_at",
      "source",
      "census_version",
      "scope",
      "observed_nodes",
      "identified_nodes",
      "coverage_percent",
      "client",
      "version",
      "count",
      "share_percent",
    ],
  ];
  const metadata = [
    census.observedAt,
    CENSUS_SOURCE_URL,
    census.censusVersion,
    census.scope,
    census.total,
    census.identified,
    census.coverage,
  ];
  for (const client of census.clients)
    rows.push([
      "client",
      ...metadata,
      client.name,
      "",
      client.count,
      client.share,
    ]);
  for (const version of census.versions)
    rows.push([
      "version_top_12",
      ...metadata,
      version.client,
      version.version,
      version.count,
      census.total === 0 ? 0 : (version.count / census.total) * 100,
    ]);
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
