/** Observed canonical-parent header intervals, not client computation times. */
export const BLOCK_TIMING_SOURCE_URL = "https://api.zecblock.com/v1/blocks";

const SOFTWARE_LABELS = {
  zebra: "Zebra",
  zakura: "Zakura",
  other: "zcashd",
  unknown: "No software tag",
  conflicting: "Conflicting tags",
  missing: "Missing coinbase data",
} as const;

export type BlockSoftware = keyof typeof SOFTWARE_LABELS;

export interface BlockTimingRow {
  key: string;
  name: string;
  blocks: number;
  timedBlocks: number;
  meanSeconds: number | null;
  medianSeconds: number | null;
  p90Seconds: number | null;
}

export interface BlockTiming {
  day: string;
  /** Time this complete response was fetched, not a source observation clock. */
  fetchedAt: string;
  /** Lowest and highest heights returned for this header-date filter. */
  firstHeight: number | null;
  lastHeight: number | null;
  totalBlocks: number;
  timedBlocks: number;
  meanSeconds: number | null;
  medianSeconds: number | null;
  nonPositiveIntervals: number;
  rows: BlockTimingRow[];
  source: string;
}

export interface TimingBlock {
  height: number;
  hash: string;
  timestamp: number;
  software: BlockSoftware;
  intervalSeconds: number | null;
}

export interface TimingPage {
  blocks: TimingBlock[];
  total: number;
  nextCursor: string | null;
  indexedHeight: number | null;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${field}: expected an object.`);
  return value as Record<string, unknown>;
}

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid ${field}: expected a nonnegative integer.`);
  return value;
}

export function previousCompleteUtcDay(now: number): string {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Validate one fixed-source page; cross-page snapshot checks belong to the reader. */
export function normalizeTimingPage(raw: unknown, day: string): TimingPage {
  const root = object(raw, "block response");
  const meta = object(root.meta, "block meta");
  if (meta.network !== "mainnet")
    throw new Error("ZecBlock block response is not confirmed mainnet.");
  const page = object(meta.page, "block pagination");
  if (
    root.truncated === true ||
    meta.truncated === true ||
    page.truncated === true
  )
    throw new Error("ZecBlock marked its block sample as truncated.");
  if (page.limit !== 100 || typeof page.hasNext !== "boolean")
    throw new Error("Invalid ZecBlock block pagination.");
  const total = count(page.total, "block pagination total");
  let nextCursor: string | null = null;
  if (page.hasNext) {
    if (
      typeof page.nextCursor !== "string" ||
      !page.nextCursor.trim() ||
      page.nextCursor.length > 8_192
    )
      throw new Error("ZecBlock pagination is missing its next cursor.");
    nextCursor = page.nextCursor;
  } else if (page.nextCursor !== null) {
    throw new Error("Invalid final ZecBlock pagination cursor.");
  }
  if (!Array.isArray(root.data) || root.data.length > 100)
    throw new Error("Invalid ZecBlock block list.");
  if (nextCursor !== null && root.data.length === 0)
    throw new Error("ZecBlock pagination returned an empty intermediate page.");

  const dayStart = Date.parse(`${day}T00:00:00.000Z`) / 1_000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(dayStart))
    throw new Error("Invalid requested UTC block day.");
  const indexedHeight =
    meta.indexedHeight === undefined || meta.indexedHeight === null
      ? null
      : count(meta.indexedHeight, "indexedHeight");
  const blocks = root.data.map((value) => {
    const row = object(value, "block row");
    const height = count(row.height, "block height");
    if (typeof row.hash !== "string" || !/^[a-fA-F0-9]{64}$/.test(row.hash))
      throw new Error("Invalid block hash.");
    if (
      typeof row.timestamp !== "number" ||
      !Number.isSafeInteger(row.timestamp) ||
      row.timestamp < dayStart ||
      row.timestamp >= dayStart + 86_400
    )
      throw new Error("Block timestamp is outside the requested UTC day.");
    if (
      typeof row.software !== "string" ||
      !Object.hasOwn(SOFTWARE_LABELS, row.software)
    )
      throw new Error("Unsupported block software identity.");
    if (
      row.intervalSeconds !== undefined &&
      row.intervalSeconds !== null &&
      (typeof row.intervalSeconds !== "number" ||
        !Number.isFinite(row.intervalSeconds))
    )
      throw new Error("Invalid canonical-parent block interval.");
    if (indexedHeight !== null && height > indexedHeight)
      throw new Error("Block height exceeds the returned indexed height.");
    return {
      height,
      hash: row.hash.toLowerCase(),
      timestamp: row.timestamp,
      software: row.software as BlockSoftware,
      intervalSeconds:
        (row.intervalSeconds as number | null | undefined) ?? null,
    };
  });
  return { blocks, total, nextCursor, indexedHeight };
}

function percentile(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[Math.ceil(position)]! * weight;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  // Scale before summing so finite signed intervals do not overflow their mean.
  const scale = values.reduce(
    (max, value) => Math.max(max, Math.abs(value)),
    0,
  );
  return scale === 0
    ? 0
    : (values.reduce((sum, value) => sum + value / scale, 0) / values.length) *
        scale;
}

export function aggregateBlockTiming(
  blocks: TimingBlock[],
  day: string,
  fetchedAt: string,
  source: string,
): BlockTiming {
  const intervals = blocks
    .flatMap((block) =>
      block.intervalSeconds === null ? [] : [block.intervalSeconds],
    )
    .sort((a, b) => a - b);
  const rows = Object.entries(SOFTWARE_LABELS).map(([key, name]) => {
    const tagged = blocks.filter((block) => block.software === key);
    const timed = tagged
      .flatMap((block) =>
        block.intervalSeconds === null ? [] : [block.intervalSeconds],
      )
      .sort((a, b) => a - b);
    return {
      key,
      name,
      blocks: tagged.length,
      timedBlocks: timed.length,
      meanSeconds: mean(timed),
      medianSeconds: percentile(timed, 0.5),
      p90Seconds: percentile(timed, 0.9),
    };
  });
  return {
    day,
    fetchedAt,
    firstHeight: blocks.at(-1)?.height ?? null,
    lastHeight: blocks[0]?.height ?? null,
    totalBlocks: blocks.length,
    timedBlocks: intervals.length,
    meanSeconds: mean(intervals),
    medianSeconds: percentile(intervals, 0.5),
    nonPositiveIntervals: intervals.filter((value) => value <= 0).length,
    rows,
    source,
  };
}
