import { ArrowUpRight } from "lucide-react";
import type { BlockTiming as Timing } from "../lib/blockTiming.ts";
import type { Resource } from "../lib/census.ts";
import { clientColor } from "../lib/colors.ts";

const seconds = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
function duration(value: number | null) {
  return value === null ? "—" : `${seconds.format(value)} s`;
}
function dayLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
export default function BlockTiming({
  resource,
  busy,
  error,
}: {
  resource: Resource<Timing> | null;
  busy: boolean;
  error: string | null;
}) {
  const data = resource?.data ?? null;
  const issue = error ?? resource?.error;
  const rows =
    data?.rows.filter(
      (row) => ["zebra", "zakura", "other"].includes(row.key) || row.blocks > 0,
    ) ?? [];
  return (
    <section className="block-timing" aria-labelledby="block-timing-title">
      <div className="section-heading">
        <div>
          <h2 id="block-timing-title">Block timing</h2>
          <p className="section-subtitle">Observed intervals by client tag</p>
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
      {issue && (
        <p className="inline-warning" role="status">
          {data
            ? "Last available timing sample. "
            : "Block timing unavailable. "}
          {issue}
        </p>
      )}
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
              "No verified timing sample"
            )}
          </p>
          <p>From one network block to the next.</p>
        </div>
        <div className="timing-client-table table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Client tag</th>
                <th scope="col" className="numeric">
                  Average interval
                </th>
                <th scope="col" className="numeric">
                  Timed blocks
                </th>
              </tr>
            </thead>
            <tbody>
              {data
                ? rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">
                        <span className="client-name">
                          <i
                            className="dot"
                            style={{ backgroundColor: clientColor(row.name) }}
                          />
                          {row.name}
                        </span>
                        {row.blocks === 0 && (
                          <span className="version-label">
                            No tagged blocks
                          </span>
                        )}
                      </th>
                      <td className="timing-interval numeric">
                        <strong>{duration(row.meanSeconds)}</strong>
                      </td>
                      <td className="numeric">
                        {row.timedBlocks.toLocaleString()}
                        <span className="timing-denominator">
                          {" "}
                          / {row.blocks.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                : ["Zebra", "Zakura", "zcashd"].map((name) => (
                    <tr key={name}>
                      <th scope="row">
                        <span className="client-name">
                          <i
                            className="dot"
                            style={{ backgroundColor: clientColor(name) }}
                          />
                          {name}
                        </span>
                      </th>
                      <td className="timing-interval numeric">—</td>
                      <td className="numeric">—</td>
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
          interval, using the same previous UTC-day window for every client.
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
            <div className="table-wrap">
              <table>
                <caption>
                  More interval statistics for {dayLabel(data.day)} UTC
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Client tag</th>
                    <th scope="col" className="numeric">
                      Median
                    </th>
                    <th scope="col" className="numeric">
                      90th percentile
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.name}</th>
                      <td className="numeric">{duration(row.medianSeconds)}</td>
                      <td className="numeric">{duration(row.p90Seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Median: half the timed blocks are at or below this interval. 90th
              percentile: nine out of ten do. Read from the source at{" "}
              {new Date(data.fetchedAt).toLocaleString()}.{" "}
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
