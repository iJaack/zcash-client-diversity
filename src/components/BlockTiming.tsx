import { ArrowUpRight } from "lucide-react";
import { useId, useState } from "react";
import type { DashboardView } from "../lib/dashboardView.ts";
import {
  previousCompleteUtcDay,
  type BlockTiming as Timing,
} from "../lib/blockTiming.ts";
import type { Resource } from "../lib/census.ts";
import { clientColor } from "../lib/colors.ts";
import { intervalBarLayout } from "../lib/timingChart.ts";
import { observationFreshness } from "../lib/freshness.ts";
import "./BlockTiming.css";

const seconds = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const intervalMetrics = {
  mean: {
    label: "Average",
    heading: "Average interval",
    field: "meanSeconds",
    explanation:
      "Average of the available intervals for each tag. Unusually long intervals can pull it upward.",
  },
  median: {
    label: "Median",
    heading: "Median interval",
    field: "medianSeconds",
    explanation:
      "The middle interval for each tag. Less affected by unusually long intervals.",
  },
  p90: {
    label: "P90",
    heading: "90th percentile",
    field: "p90Seconds",
    explanation:
      "Highlights longer intervals: about nine in ten timed intervals are at or below this value.",
  },
} as const;
const metricKeys = ["mean", "median", "p90"] as const;
function duration(value: number | null) {
  return value === null ? "—" : `${seconds.format(value)} s`;
}
function isUtcDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}
function dayLabel(value: string) {
  if (!isUtcDay(value)) return "Unknown day";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
function readTimeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "Unknown read time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}
export default function BlockTiming({
  resource,
  busy,
  error,
  metric,
  onMetricChange,
  now,
}: {
  resource: Resource<Timing> | null;
  busy: boolean;
  error: string | null;
  metric: DashboardView["metric"];
  onMetricChange: (metric: DashboardView["metric"]) => void;
  now: number;
}) {
  const selectedMetric = intervalMetrics[metric];
  const comparisonId = useId();
  const data = resource?.data ?? null;
  const freshness = data ? observationFreshness(data.fetchedAt, now) : null;
  const expectedDay = previousCompleteUtcDay(now);
  const dayWarning =
    data && data.day !== expectedDay
      ? !isUtcDay(data.day)
        ? `The sample's UTC date is invalid. Use Refresh to request ${dayLabel(expectedDay)} UTC.`
        : data.day < expectedDay
          ? `Older daily sample. Use Refresh to request the latest complete UTC day: ${dayLabel(expectedDay)} UTC.`
          : `The sample date is later than the latest complete UTC day (${dayLabel(expectedDay)} UTC). Check your device clock and use Refresh.`
      : null;
  const [selection, setSelection] = useState<{
    day: string;
    key: string;
  } | null>(null);
  const issue = error ?? resource?.error;
  const rows =
    data?.rows.filter(
      (row) => ["zebra", "zakura", "other"].includes(row.key) || row.blocks > 0,
    ) ??
    ["Zebra", "Zakura", "zcashd"].map((name) => ({
      key: name,
      name,
      blocks: null,
      timedBlocks: null,
      meanSeconds: null,
      medianSeconds: null,
      p90Seconds: null,
    }));
  const selected =
    selection?.day === data?.day
      ? (rows.find((row) => row.key === selection?.key) ?? null)
      : null;
  const selectTag = (key: string) => {
    if (data)
      setSelection(selected?.key === key ? null : { day: data.day, key });
  };
  const chart = intervalBarLayout(rows.map((row) => row[selectedMetric.field]));
  return (
    <section className="block-timing" aria-labelledby="block-timing-title">
      <div className="section-heading">
        <div>
          <h2 id="block-timing-title">Observed block intervals</h2>
          <p className="section-subtitle">
            Grouped by self-reported client tags
          </p>
        </div>
        <a
          className="timing-source"
          href="https://zecblock.com/mining"
          target="_blank"
          rel="noreferrer"
        >
          Source <ArrowUpRight size={14} />
        </a>
      </div>
      <p className="timing-context">
        <strong>Client performance is not measured here.</strong> These are
        times between network blocks, grouped by the tag on the ending block.
      </p>
      {issue && (
        <p className="inline-warning" role="status">
          {data
            ? "Last available timing sample. "
            : "Block timing unavailable. "}
          {issue}
        </p>
      )}
      {dayWarning && (
        <p className="inline-warning timing-day-warning" role="status">
          {dayWarning}
        </p>
      )}
      {freshness?.clockSkew ? (
        <p className="inline-warning timing-read-warning" role="status">
          The sample read time is ahead of this device’s clock. Check the clock
          and use Refresh.
        </p>
      ) : freshness?.delayed ? (
        <p className="inline-warning timing-read-warning" role="status">
          This daily sample was last read over 15 minutes ago. Use Refresh to
          check the source again.
        </p>
      ) : null}
      <div className="timing-layout">
        <div className="timing-overview">
          <span className="eyebrow">SAMPLE AVERAGE</span>
          <p className="timing-value">
            {data?.meanSeconds !== null && data?.meanSeconds !== undefined
              ? seconds.format(data.meanSeconds)
              : "—"}
            <span>
              {data?.meanSeconds !== null && data?.meanSeconds !== undefined
                ? "s"
                : ""}
            </span>
          </p>
          <p className="timing-window">
            {data ? (
              <>
                {dayLabel(data.day)} UTC · {data.totalBlocks.toLocaleString()}{" "}
                indexed blocks
              </>
            ) : busy ? (
              "Reading the previous UTC day…"
            ) : (
              "No timing sample available"
            )}
          </p>
          {data && freshness && (
            <p className="timing-capture">
              Sample read{" "}
              <time dateTime={data.fetchedAt}>
                {readTimeLabel(data.fetchedAt)}
              </time>{" "}
              · {freshness.ageLabel}
            </p>
          )}
          <p>From one network block to the next.</p>
        </div>
        <div className="timing-comparison">
          <div className="timing-controls">
            <span id={`${comparisonId}-label`}>Interval statistic</span>
            <div
              className="segmented small"
              role="group"
              aria-labelledby={`${comparisonId}-label`}
            >
              {metricKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={metric === key}
                  aria-controls={`${comparisonId}-chart ${comparisonId}-table`}
                  onClick={() => onMetricChange(key)}
                >
                  {intervalMetrics[key].label}
                </button>
              ))}
            </div>
          </div>
          <p
            className="timing-metric-note"
            id={`${comparisonId}-description`}
            aria-live="polite"
          >
            {selectedMetric.explanation} Timed block counts show each sample’s
            size.
          </p>
          <div
            id={`${comparisonId}-chart`}
            className="timing-chart"
            role="group"
            aria-label={`${selectedMetric.heading} by client tag`}
          >
            <p className="timing-chart-hint">
              Select a tag to explore its sample.
            </p>
            {rows.map((row, index) => {
              const bar = chart.bars[index];
              const value = row[selectedMetric.field];
              return (
                <button
                  type="button"
                  className="timing-chart-row"
                  key={row.key}
                  disabled={!data}
                  aria-pressed={selected?.key === row.key}
                  aria-controls={`${comparisonId}-selection`}
                  aria-label={`Inspect ${row.name}: ${selectedMetric.heading.toLowerCase()} ${value === null ? "unavailable" : duration(value)}; ${row.timedBlocks === null ? "timing sample unavailable" : `${row.timedBlocks.toLocaleString()} of ${row.blocks?.toLocaleString()} blocks timed`}`}
                  onClick={() => selectTag(row.key)}
                >
                  <span className="timing-chart-name">
                    {row.name}
                    <small>
                      {row.timedBlocks?.toLocaleString() ?? "—"} /{" "}
                      {row.blocks?.toLocaleString() ?? "—"} timed
                    </small>
                  </span>
                  <span className="timing-chart-track" aria-hidden="true">
                    <span
                      className="timing-chart-zero"
                      style={{ left: `${chart.zero}%` }}
                    />
                    {bar && (
                      <span
                        className={`timing-chart-bar${bar.width === 0 ? " measured-zero" : ""}`}
                        style={{
                          left: `${bar.left}%`,
                          width: `${bar.width}%`,
                          backgroundColor: clientColor(row.name),
                        }}
                      />
                    )}
                  </span>
                  <strong>{duration(value)}</strong>
                </button>
              );
            })}
            {chart.hasValues && (
              <div className="timing-chart-axis" aria-hidden="true">
                <div>
                  <span>{duration(chart.minimum)}</span>
                  {chart.maximum !== chart.minimum && (
                    <span>{duration(chart.maximum)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div
            id={`${comparisonId}-selection`}
            className="timing-selection"
            aria-live="polite"
          >
            {selected && (
              <>
                <div className="timing-selection-heading">
                  <h3>
                    <i
                      className="dot"
                      style={{ backgroundColor: clientColor(selected.name) }}
                    />
                    {selected.name} sample
                  </h3>
                  <button
                    type="button"
                    className="timing-clear-selection"
                    onClick={() => setSelection(null)}
                  >
                    Clear selection
                  </button>
                </div>
                <dl className="timing-selection-stats">
                  {metricKeys.map((key) => (
                    <div key={key} data-active={key === metric}>
                      <dt>{intervalMetrics[key].label}</dt>
                      <dd>{duration(selected[intervalMetrics[key].field])}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {selected.timedBlocks?.toLocaleString()} of{" "}
                  {selected.blocks?.toLocaleString()} indexed blocks have timing
                  data.
                </p>
                {selected.blocks === 0 ? (
                  <p>
                    No matching blocks in this sample. This does not establish
                    whether the client is used elsewhere.
                  </p>
                ) : selected.timedBlocks === 0 ? (
                  <p>Intervals are unavailable for these blocks.</p>
                ) : null}
              </>
            )}
          </div>
          <details className="timing-table-details">
            <summary>View interval statistics as a table</summary>
            <div className="timing-client-table table-wrap">
              <table
                id={`${comparisonId}-table`}
                aria-describedby={`${comparisonId}-description`}
              >
                <thead>
                  <tr>
                    <th scope="col">Client tag</th>
                    <th scope="col" className="numeric">
                      {selectedMetric.heading}
                    </th>
                    <th scope="col" className="numeric">
                      Timed blocks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} data-selected={selected?.key === row.key}>
                      <th scope="row">
                        <button
                          type="button"
                          className="client-name timing-tag-button"
                          disabled={!data}
                          aria-pressed={selected?.key === row.key}
                          aria-controls={`${comparisonId}-selection`}
                          onClick={() => selectTag(row.key)}
                        >
                          <i
                            className="dot"
                            style={{ backgroundColor: clientColor(row.name) }}
                          />
                          {row.name}
                        </button>
                        {row.blocks === 0 && (
                          <span className="version-label">
                            No tagged blocks
                          </span>
                        )}
                      </th>
                      <td className="timing-interval numeric">
                        {data ? (
                          <strong>{duration(row[selectedMetric.field])}</strong>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="numeric">
                        {row.timedBlocks?.toLocaleString() ?? "—"}
                        {row.blocks !== null && (
                          <span className="timing-denominator">
                            {" "}
                            / {row.blocks.toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {busy && !data && (
                <p className="empty-copy" role="status">
                  Loading block-header observations…
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
      <p className="timing-explainer">
        Mining power, difficulty and chance affect block timing. Self-reported
        tags group indexed observations, with potentially partial coverage.
        Comparing client processing speed requires a controlled benchmark.
      </p>
      <details className="timing-details">
        <summary>How timing is measured</summary>
        <p>
          Each interval is a block’s timestamp minus its previous network
          block’s timestamp. We group it by the tag on the block that ends the
          interval, using the same displayed UTC-day window for every tag.
          Averages include every available interval, including repeated or
          backward timestamps. Missing intervals stay unavailable.
        </p>
        <p>
          The feed supplies indexed observations; its pagination covers all
          returned matches, which may be less than the full network history.
          Seeders do not mine blocks. Comparing client processing speed requires
          tests with matching hardware, client versions and workloads.
        </p>
        {data && (
          <>
            <p>
              {data.timedBlocks.toLocaleString()} of{" "}
              {data.totalBlocks.toLocaleString()} returned blocks have timing
              data.{" "}
              {data.nonPositiveIntervals > 0
                ? `${data.nonPositiveIntervals.toLocaleString()} repeated or backward timestamps are included.`
                : "No repeated or backward timestamps in this sample."}{" "}
              Zero matching tags is not proof that a client is unused.
            </p>
            <p>
              Median: half the timed blocks are at or below this interval. 90th
              percentile: nine out of ten do.{" "}
              <a href={data.source} target="_blank" rel="noreferrer">
                View block sample <ArrowUpRight size={12} />
              </a>
            </p>
          </>
        )}
      </details>
    </section>
  );
}
