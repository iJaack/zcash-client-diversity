import { useId, useMemo } from "react";
import type { HistoryPoint } from "../lib/census.ts";
import { clientColor } from "../lib/colors.ts";
import {
  buildLinePaths,
  historyCsv,
  HISTORY_PLOT,
  MAX_SERIES_POINTS,
} from "../lib/history.ts";

const shareFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const countFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const timestampFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const shortTimeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const dashPatterns = ["", "7 3", "2 3", "9 3 2 3", "4 3"];

export function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const id = useId();
  const history = useMemo(() => buildLinePaths(points), [points]);
  const downloadHistory = () => {
    const blob = new Blob([historyCsv(history.points)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zcash-client-share-history.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };
  const comparable = history.points.filter(
    (point) => point.total > 0 && point.clients.length > 0,
  );
  if (
    comparable.length < 2 ||
    !history.series.some((series) => series.sourcePointCount > 1)
  ) {
    return (
      <>
        <div className="empty-state">No comparable history available.</div>
        {history.points.length > 0 && (
          <button
            type="button"
            className="history-export"
            onClick={downloadHistory}
          >
            Download full history CSV
          </button>
        )}
      </>
    );
  }
  const latest = history.points.at(-1)!;
  const recent = history.points.slice(-20).reverse();
  const sampled = history.series.some(
    (series) => series.plottedPointCount < series.sourcePointCount,
  );
  const shortWindow = history.end - history.start <= 2 * 24 * 60 * 60 * 1_000;
  const ticks = [0, 1 / 3, 2 / 3, 1].map((fraction) => ({
    x: HISTORY_PLOT.left + fraction * (HISTORY_PLOT.right - HISTORY_PLOT.left),
    time: history.start + fraction * (history.end - history.start),
  }));
  return (
    <>
      <div
        className="history-plot-scroll"
        tabIndex={0}
        role="region"
        aria-label="Client share chart, scroll horizontally on small screens"
      >
        <svg
          className="history-svg"
          viewBox="0 0 760 260"
          width="100%"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <title id={`${id}-title`}>
            Client share of observed active Zcash IPs over time
          </title>
          <desc id={`${id}-description`}>
            {history.points.length} observations from{" "}
            {timestampFormat.format(history.start)} to{" "}
            {timestampFormat.format(history.end)} UTC. The vertical scale is 0
            to 100 percent. Lines stop at gaps longer than 15 minutes, missing
            observations, and census version changes. Latest shares are listed
            below; the latest 20 observations are available in the data table.
            The full history CSV download contains every observation in the
            selected time window.
            {sampled
              ? ` Lines are sampled to at most ${MAX_SERIES_POINTS} points per client.`
              : ""}
          </desc>
          <rect width="760" height="260" fill="var(--chart-surface)" />
          {[0, 25, 50, 75, 100].map((share) => {
            const y =
              HISTORY_PLOT.bottom -
              (share / 100) * (HISTORY_PLOT.bottom - HISTORY_PLOT.top);
            return (
              <g key={share}>
                <line
                  x1={HISTORY_PLOT.left}
                  y1={y}
                  x2={HISTORY_PLOT.right}
                  y2={y}
                  stroke="var(--rule)"
                  strokeWidth="0.8"
                />
                <text
                  x="31"
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize="11"
                >
                  {share}%
                </text>
              </g>
            );
          })}
          {history.series.map((series, index) => (
            <g
              key={series.name}
              fill="none"
              stroke={clientColor(series.name)}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {series.paths.map((path, pathIndex) => (
                <path
                  key={pathIndex}
                  d={path}
                  strokeDasharray={
                    dashPatterns[index % dashPatterns.length] || undefined
                  }
                />
              ))}
              {series.segments
                .filter((segment) => segment.length === 1)
                .map((segment) => (
                  <circle
                    key={segment[0].time}
                    cx={segment[0].x}
                    cy={segment[0].y}
                    r="2.2"
                    fill={clientColor(series.name)}
                    stroke="none"
                  />
                ))}
            </g>
          ))}
          {ticks.map((tick, index) => (
            <text
              key={index}
              x={tick.x}
              y="244"
              fontSize="11"
              fill="var(--muted)"
              textAnchor={
                index === 0
                  ? "start"
                  : index === ticks.length - 1
                    ? "end"
                    : "middle"
              }
            >
              {dateFormat.format(tick.time)}
              {shortWindow ? ` ${shortTimeFormat.format(tick.time)}` : ""}
            </text>
          ))}
        </svg>
      </div>
      <p className="chart-scroll-hint">Scroll to explore the timeline.</p>
      <div className="chart-legend" aria-label="Latest client shares">
        {history.series.map((series, index) => (
          <span className="legend-item" key={series.name}>
            <svg
              width="24"
              height="12"
              viewBox="0 0 24 12"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <line
                x1="1"
                y1="6"
                x2="23"
                y2="6"
                stroke={clientColor(series.name)}
                strokeWidth="2"
                strokeDasharray={
                  dashPatterns[index % dashPatterns.length] || undefined
                }
              />
            </svg>
            <span>
              {series.name}{" "}
              <strong>
                {series.latestShare === null
                  ? "—"
                  : `${shareFormat.format(series.latestShare)}%`}
              </strong>
            </span>
          </span>
        ))}
      </div>
      <p className="history-caption">
        Latest shares:{" "}
        <time dateTime={latest.at}>
          {timestampFormat.format(Date.parse(latest.at))} UTC
        </time>
        . Gaps over 15 minutes and census changes interrupt the lines.
        {sampled
          ? ` Lines sampled to at most ${countFormat.format(MAX_SERIES_POINTS)} points per client.`
          : ""}
      </p>
      <details className="history-details">
        <summary>View latest {recent.length} observations as a table</summary>
        <p>
          All {countFormat.format(history.points.length)} observations in this
          time window are available as a CSV.
        </p>
        <button
          type="button"
          className="history-export"
          onClick={downloadHistory}
        >
          Download full history CSV
        </button>
        <div className="table-wrap">
          <table>
            <caption>
              Latest {recent.length} of{" "}
              {countFormat.format(history.points.length)} observations. Times
              are UTC.
            </caption>
            <thead>
              <tr>
                <th scope="col">Observed</th>
                <th scope="col">Client</th>
                <th scope="col">Nodes</th>
                <th scope="col">Share</th>
                <th scope="col">Census</th>
              </tr>
            </thead>
            <tbody>
              {recent.flatMap((point) =>
                point.clients.map((client) => (
                  <tr key={`${point.at}-${point.censusVersion}-${client.name}`}>
                    <td>
                      <time dateTime={point.at}>
                        {timestampFormat.format(Date.parse(point.at))}
                      </time>
                    </td>
                    <th scope="row">{client.name}</th>
                    <td>{countFormat.format(client.count)}</td>
                    <td>
                      {point.total > 0
                        ? `${shareFormat.format(client.share)}%`
                        : "—"}
                    </td>
                    <td>{point.censusVersion}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export default HistoryChart;
