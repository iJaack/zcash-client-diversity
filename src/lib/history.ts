import type { HistoryPoint } from "./census.ts";

export const MAX_SERIES_POINTS = 1_500;
export const HISTORY_GAP_MS = 15 * 60 * 1_000;
export const HISTORY_PLOT = { left: 40, right: 740, top: 12, bottom: 220 };
export const HISTORY_SOURCE_URL =
  "https://api.zecblock.com/v1/network/nodes/history";

function csvCell(value: string | number): string {
  let cell = String(value);
  // CSV quoting does not disable spreadsheet formulas, including after whitespace.
  if (/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

/** Exports the complete supplied observations, without chart sampling or gap filling. */
export function historyCsv(points: HistoryPoint[]): string {
  const rows: Array<Array<string | number>> = [
    [
      "observed_at_utc",
      "client",
      "count",
      "share_percent",
      "total_observed_ips",
      "census_version",
      "source",
    ],
  ];
  for (const point of points) {
    if (!point.clients.length) {
      rows.push([
        point.at,
        "",
        "",
        "",
        point.total,
        point.censusVersion,
        HISTORY_SOURCE_URL,
      ]);
      continue;
    }
    for (const client of point.clients) {
      rows.push([
        point.at,
        client.name,
        client.count,
        point.total > 0 ? client.share : "",
        point.total,
        point.censusVersion,
        HISTORY_SOURCE_URL,
      ]);
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export interface PlotPoint {
  time: number;
  share: number;
  x: number;
  y: number;
}

export interface HistorySeries {
  name: string;
  paths: string[];
  segments: PlotPoint[][];
  latestShare: number | null;
  sourcePointCount: number;
  plottedPointCount: number;
}

/** Largest-triangle sampling keeps endpoints and significant changes within a segment. */
function sampleSegment(points: PlotPoint[], limit: number): PlotPoint[] {
  if (points.length <= limit) return points;
  if (limit <= 0) return [];
  if (limit === 1) return [points.at(-1)!];
  if (limit === 2) return [points[0], points.at(-1)!];
  const sampled = [points[0]];
  const bucketWidth = (points.length - 2) / (limit - 2);
  let selected = 0;
  for (let bucket = 0; bucket < limit - 2; bucket += 1) {
    const averageStart = Math.floor((bucket + 1) * bucketWidth) + 1;
    const averageEnd = Math.min(
      Math.floor((bucket + 2) * bucketWidth) + 1,
      points.length,
    );
    let averageX = 0;
    let averageY = 0;
    for (let index = averageStart; index < averageEnd; index += 1) {
      averageX += points[index].x;
      averageY += points[index].y;
    }
    averageX /= averageEnd - averageStart;
    averageY /= averageEnd - averageStart;
    const rangeStart = Math.floor(bucket * bucketWidth) + 1;
    const rangeEnd = Math.min(
      Math.floor((bucket + 1) * bucketWidth) + 1,
      points.length - 1,
    );
    const anchor = points[selected];
    let largestArea = -1;
    let next = rangeStart;
    for (let index = rangeStart; index < rangeEnd; index += 1) {
      const candidate = points[index];
      const area = Math.abs(
        (anchor.x - averageX) * (candidate.y - anchor.y) -
          (anchor.x - candidate.x) * (averageY - anchor.y),
      );
      if (area > largestArea) {
        largestArea = area;
        next = index;
      }
    }
    sampled.push(points[next]);
    selected = next;
  }
  sampled.push(points.at(-1)!);
  return sampled;
}

function sampleSegments(segments: PlotPoint[][], limit: number): PlotPoint[][] {
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (total <= limit) return segments;
  const minimums = segments.map((segment) => Math.min(2, segment.length));
  const required = minimums.reduce((sum, length) => sum + length, 0);
  if (required > limit) {
    // An extreme number of interruptions cannot all fit. Omit older segments;
    // never join observations across their original segment boundary.
    let remaining = limit;
    const retained: PlotPoint[][] = [];
    for (
      let index = segments.length - 1;
      index >= 0 && remaining > 0;
      index -= 1
    ) {
      const allowance = Math.min(minimums[index], remaining);
      retained.unshift(sampleSegment(segments[index], allowance));
      remaining -= allowance;
    }
    return retained;
  }
  const extra = limit - required;
  const interiors = total - required;
  const allocations = minimums.map(
    (minimum, index) =>
      minimum +
      Math.floor((extra * (segments[index].length - minimum)) / interiors),
  );
  let spare =
    limit - allocations.reduce((sum, allocation) => sum + allocation, 0);
  for (
    let index = segments.length - 1;
    spare > 0;
    index = (index - 1 + segments.length) % segments.length
  ) {
    if (allocations[index] < segments[index].length) {
      allocations[index] += 1;
      spare -= 1;
    }
  }
  return segments.map((segment, index) =>
    sampleSegment(segment, allocations[index]),
  );
}

/** Shares use a fixed 0–100 scale. Missing observations and census changes split paths. */
export function buildLinePaths(
  points: HistoryPoint[],
  maxPoints = MAX_SERIES_POINTS,
): {
  series: HistorySeries[];
  start: number;
  end: number;
  points: HistoryPoint[];
} {
  const observations = points
    .map((point) => ({ point, time: Date.parse(point.at) }))
    .filter((observation) => Number.isFinite(observation.time))
    .sort((left, right) => left.time - right.time);
  const start = observations[0]?.time ?? 0;
  const end = observations.at(-1)?.time ?? start;
  const span = end - start;
  const names = [
    ...new Set(
      observations.flatMap(({ point }) =>
        point.clients.map((client) => client.name),
      ),
    ),
  ];
  const limit = Math.max(
    1,
    Math.min(MAX_SERIES_POINTS, Math.floor(maxPoints) || MAX_SERIES_POINTS),
  );
  const series = names.map((name) => {
    const segments: PlotPoint[][] = [];
    let segment: PlotPoint[] = [];
    let previous: (typeof observations)[number] | undefined;
    for (const observation of observations) {
      const client = observation.point.clients.find(
        (candidate) => candidate.name === name,
      );
      const validShare =
        observation.point.total > 0 &&
        client &&
        Number.isFinite(client.share) &&
        client.share >= 0 &&
        client.share <= 100;
      const interrupted =
        previous &&
        (observation.time - previous.time > HISTORY_GAP_MS ||
          observation.time <= previous.time ||
          observation.point.censusVersion !== previous.point.censusVersion);
      if (!validShare || interrupted) {
        if (segment.length) segments.push(segment);
        segment = [];
      }
      if (validShare) {
        segment.push({
          time: observation.time,
          share: client.share,
          x:
            span > 0
              ? HISTORY_PLOT.left +
                ((observation.time - start) / span) *
                  (HISTORY_PLOT.right - HISTORY_PLOT.left)
              : (HISTORY_PLOT.left + HISTORY_PLOT.right) / 2,
          y:
            HISTORY_PLOT.bottom -
            (client.share / 100) * (HISTORY_PLOT.bottom - HISTORY_PLOT.top),
        });
      }
      previous = observation;
    }
    if (segment.length) segments.push(segment);
    const sampled = sampleSegments(segments, limit);
    const latest = observations.at(-1)?.point;
    const latestClient = latest?.clients.find((client) => client.name === name);
    return {
      name,
      segments: sampled,
      paths: sampled.map((run) =>
        run
          .map(
            (point, index) =>
              `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
          )
          .join(" "),
      ),
      latestShare:
        latest &&
        latest.total > 0 &&
        latestClient &&
        Number.isFinite(latestClient.share) &&
        latestClient.share >= 0 &&
        latestClient.share <= 100
          ? latestClient.share
          : null,
      sourcePointCount: segments.reduce((sum, run) => sum + run.length, 0),
      plottedPointCount: sampled.reduce((sum, run) => sum + run.length, 0),
    };
  });
  return {
    series,
    start,
    end,
    points: observations.map((observation) => observation.point),
  };
}
