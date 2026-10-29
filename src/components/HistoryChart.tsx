import { useId, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { HistoryPoint } from "../lib/census.ts";
import { clientColor } from "../lib/colors.ts";
import {
  buildLinePaths,
  historyCsv,
  HISTORY_PLOT,
  MAX_SERIES_POINTS,
} from "../lib/history.ts";
import {
  historyTimeAtX,
  nearestObservationIndex,
  observationSelectionAtIndex,
  resolveObservationSelection,
} from "../lib/historyInteraction.ts";
import type { ObservationSelection } from "../lib/historyInteraction.ts";

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

export function HistoryChart({
  points,
  focusedClient = "all",
  onFocusClient,
}: {
  points: HistoryPoint[];
  focusedClient?: string;
  onFocusClient?: (client: string) => void;
}) {
  const id = useId();
  const history = useMemo(() => buildLinePaths(points), [points]);
  const times = useMemo(
    () => history.points.map((point) => Date.parse(point.at)),
    [history.points],
  );
  const [selection, setSelection] = useState<ObservationSelection | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const selectedIndex =
    selection === null
      ? Math.max(0, times.length - 1)
      : (resolveObservationSelection(times, selection) ?? 0);
  const selected = history.points[selectedIndex];
  const selectIndex = (index: number) => {
    const next = observationSelectionAtIndex(
      times,
      Math.max(0, Math.min(times.length - 1, index)),
    );
    if (next)
      setSelection((previous) =>
        previous?.time === next.time && previous.occurrence === next.occurrence
          ? previous
          : next,
      );
  };
  const inspectPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 760;
    const requested = historyTimeAtX(x, history.start, history.end);
    if (requested === null) return;
    const index = nearestObservationIndex(times, requested);
    if (index !== null) selectIndex(index);
  };
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
  const selectedX =
    history.end > history.start
      ? HISTORY_PLOT.left +
        ((times[selectedIndex] - history.start) /
          (history.end - history.start)) *
          (HISTORY_PLOT.right - HISTORY_PLOT.left)
      : (HISTORY_PLOT.left + HISTORY_PLOT.right) / 2;
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
          onPointerMove={(event) => {
            if (event.pointerType !== "touch") inspectPointer(event);
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "touch")
              touchStart.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = touchStart.current;
            if (
              event.pointerType === "touch" &&
              start &&
              Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8
            )
              inspectPointer(event);
            touchStart.current = null;
          }}
          onPointerCancel={() => {
            touchStart.current = null;
          }}
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
            Hover or tap to inspect a recorded observation. The timeline slider
            and previous/next buttons provide keyboard access to every original
            observation, including points omitted from the drawn lines. The full
            history CSV download contains every observation in the selected time
            window.
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
              opacity={
                focusedClient === "all" || focusedClient === series.name
                  ? 1
                  : 0.22
              }
              data-client={series.name}
              data-focused={focusedClient === series.name}
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
          <g
            className="chart-crosshair"
            pointerEvents="none"
            aria-hidden="true"
          >
            <line
              x1={selectedX}
              x2={selectedX}
              y1={HISTORY_PLOT.top}
              y2={HISTORY_PLOT.bottom}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            {selected.clients
              .filter(
                (client) =>
                  selected.total > 0 &&
                  Number.isFinite(client.share) &&
                  client.share >= 0 &&
                  client.share <= 100,
              )
              .map((client) => (
                <circle
                  key={client.name}
                  cx={selectedX}
                  cy={
                    HISTORY_PLOT.bottom -
                    (client.share / 100) *
                      (HISTORY_PLOT.bottom - HISTORY_PLOT.top)
                  }
                  r="3.5"
                  fill={clientColor(client.name)}
                  stroke="var(--canvas)"
                  strokeWidth="1.5"
                  opacity={
                    focusedClient === "all" || focusedClient === client.name
                      ? 1
                      : 0.22
                  }
                />
              ))}
          </g>
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
      <p className="chart-scroll-hint">
        Tap to inspect. Scroll sideways to explore the timeline.
      </p>
      <div className="chart-legend" aria-label="Latest client shares">
        {history.series.map((series, index) => (
          <button
            type="button"
            className="legend-item"
            key={series.name}
            aria-pressed={focusedClient === series.name}
            disabled={!onFocusClient}
            onClick={() => onFocusClient?.(series.name)}
            aria-label={`Focus node views on ${series.name}`}
          >
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
          </button>
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
      <section
        className="chart-inspector"
        aria-labelledby={`${id}-inspector-title`}
      >
        <div className="chart-inspector-heading">
          <div>
            <h3 id={`${id}-inspector-title`}>Selected observation</h3>
            <time dateTime={selected.at}>
              {timestampFormat.format(times[selectedIndex])} UTC
            </time>
          </div>
          <strong>{countFormat.format(selected.total)} observed IPs</strong>
        </div>
        <p className="chart-inspector-summary">
          Nearest recorded sample · Census v{selected.censusVersion}. No values
          are interpolated between observations.
        </p>
        <ul className="chart-inspector-clients">
          {selected.clients.map((client) => (
            <li
              className="chart-inspector-client"
              key={client.name}
              data-focused={focusedClient === client.name}
            >
              <span className="client-name">
                <i
                  className="dot"
                  style={{ backgroundColor: clientColor(client.name) }}
                />
                {client.name}
              </span>
              <strong>{countFormat.format(client.count)}</strong>
              <span>
                {selected.total > 0
                  ? `${shareFormat.format(client.share)}%`
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
        {!selected.clients.length && (
          <p className="chart-inspector-summary">
            No client values were recorded in this observation.
          </p>
        )}
        {focusedClient !== "all" &&
          !selected.clients.some((client) => client.name === focusedClient) && (
            <p className="chart-inspector-summary">
              No {focusedClient} value was recorded in this observation.
            </p>
          )}
        <div className="chart-scrubber">
          <label htmlFor={`${id}-timeline`}>Inspect timeline</label>
          <input
            id={`${id}-timeline`}
            className="chart-scrubber-range"
            type="range"
            min="0"
            max={times.length - 1}
            step="1"
            value={selectedIndex}
            onChange={(event) => selectIndex(Number(event.target.value))}
            aria-valuetext={`${timestampFormat.format(times[selectedIndex])} UTC; ${countFormat.format(selected.total)} observed IPs`}
          />
          <div className="chart-scrubber-actions">
            <button
              type="button"
              className="chart-control"
              disabled={selectedIndex === 0}
              onClick={() => selectIndex(selectedIndex - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="chart-control"
              disabled={selectedIndex === times.length - 1}
              onClick={() => selectIndex(selectedIndex + 1)}
            >
              Next
            </button>
            <button
              type="button"
              className="chart-control"
              disabled={selectedIndex === times.length - 1}
              onClick={() => setSelection(null)}
            >
              Latest
            </button>
          </div>
        </div>
      </section>
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
              {recent.flatMap((point, pointIndex) =>
                point.clients.map((client) => (
                  <tr
                    key={`${point.at}-${point.censusVersion}-${pointIndex}-${client.name}`}
                  >
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
