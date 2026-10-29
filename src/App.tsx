import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Download,
  RefreshCw,
} from "lucide-react";
import { useDashboard } from "./lib/useDashboard.ts";
import { csvForCensus } from "./lib/census.ts";
import { clientColor } from "./lib/colors.ts";
import ClientTable from "./components/ClientTable.tsx";
import HistoryChart from "./components/HistoryChart.tsx";
import Methodology from "./components/Methodology.tsx";
const repository = "https://github.com/iJaack/zcash-client-diversity";
function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
function App() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [view, setView] = useState<"distribution" | "versions">("distribution");
  const [filter, setFilter] = useState("all");
  const { payload, busy, error, refresh } = useDashboard(period);
  const census = payload?.current.data ?? null;
  const history = payload?.history.data ?? [];
  const currentError = error ?? payload?.current.error;
  const old = census
    ? now - new Date(census.observedAt).valueOf() > 15 * 60_000
    : false;
  const status = !census
    ? busy
      ? "Connecting to ZecBlock"
      : "Current census unavailable"
    : currentError
      ? "Showing last available observation"
      : old
        ? "Source observation is delayed"
        : "Source connected · ZecBlock";
  const stale = Boolean(currentError || old);
  const exportData = () => {
    if (!census) return;
    const blob = new Blob(
      [
        csvForCensus({
          ...census,
          clients:
            view === "distribution"
              ? census.clients.filter(
                  (row) => filter === "all" || row.name === filter,
                )
              : [],
          versions:
            view === "versions"
              ? census.versions.filter(
                  (row) => filter === "all" || row.client === filter,
                )
              : [],
        }),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zcash-client-diversity-${census.observedAt.replace(/[:.]/g, "-")}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <a href="#overview" className="skip-link">
        Skip to dashboard
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#overview">
            <img src="/favicon.svg" alt="" width="38" height="38" />
            <span>Zcash observatory</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#overview" className="active">
              Overview
            </a>
            <a href="#methodology">Methodology</a>
            <a href={repository} target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={15} />
            </a>
          </nav>
        </div>
      </header>
      <main id="overview" className="page" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <span className="eyebrow">NETWORK OBSERVATORY</span>
            <h1>Zcash client diversity</h1>
            <p className="lead">
              See which clients this view of the network observes.
            </p>
          </div>
          <div className="page-actions">
            <button
              className="button secondary"
              onClick={exportData}
              disabled={!census}
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              className="button primary"
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw size={16} className={busy ? "spinning" : ""} />
              {busy ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <div
          className={`source-banner ${stale ? "warning" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-icon">
            {stale ? (
              <CircleAlert size={23} />
            ) : census ? (
              <Check size={23} />
            ) : (
              <Clock3 size={23} />
            )}
          </span>
          <div>
            <strong>{status}</strong>
            <p>
              {census ? (
                <>
                  Observed {formatTime(census.observedAt)} · Census v
                  {census.censusVersion} · {census.coverage.toFixed(1)}%
                  identified
                </>
              ) : (
                "Counts will appear after a successful source request. No estimated or demo measurements."
              )}
              {currentError && (
                <span className="error-detail">{currentError}</span>
              )}
            </p>
          </div>
          <a
            href="https://zecblock.com/network/nodes"
            target="_blank"
            rel="noreferrer"
            className="source-link"
          >
            View source <ArrowUpRight size={15} />
          </a>
        </div>
        <section className="distribution" aria-labelledby="distribution-title">
          <div className="section-heading">
            <div>
              <h2 id="distribution-title">Client distribution</h2>
              <p className="section-subtitle">
                Share of observed active IPs · Zcash mainnet
              </p>
            </div>
            <div className="segmented" aria-label="Table grouping">
              <button
                aria-pressed={view === "distribution"}
                onClick={() => setView("distribution")}
              >
                Distribution
              </button>
              <button
                aria-pressed={view === "versions"}
                onClick={() => setView("versions")}
              >
                Versions
              </button>
            </div>
          </div>
          <div className="census-summary">
            <div>
              <span className="total-count">
                {census?.total.toLocaleString() ?? "—"}
              </span>
              <span>observed IPs</span>
            </div>
            <span className="summary-divider" />
            <p>
              {census ? (
                <>
                  {census.countries ?? "—"} countries{" "}
                  <span className="separator">·</span>{" "}
                  {census.identified.toLocaleString()} identified peers
                </>
              ) : (
                "Waiting for a verified observation"
              )}
            </p>
          </div>
          <div
            className={`share-bar ${!census?.total ? "empty" : ""}`}
            role="img"
            aria-label={
              census
                ? census.clients
                    .map(
                      (row) =>
                        `${row.name}: ${row.count} IPs, ${row.share.toFixed(1)} percent`,
                    )
                    .join("; ")
                : "Client distribution unavailable"
            }
          >
            {census?.clients
              .filter((row) => row.count > 0)
              .map((row) => (
                <div
                  key={row.name}
                  style={{
                    width: `${row.share}%`,
                    background: clientColor(row.name),
                  }}
                  title={`${row.name}: ${row.share.toFixed(1)}%`}
                >
                  {row.share > 8 && <span>{row.share.toFixed(1)}%</span>}
                </div>
              ))}
          </div>
          <div className="distribution-legend">
            {(
              census?.clients ??
              ["Zebra", "Zakura", "zcashd", "Unknown"].map((name) => ({
                name,
                count: null,
                share: null,
              }))
            ).map((row) => (
              <div key={row.name} className="distribution-key">
                <i
                  className="dot"
                  style={{ backgroundColor: clientColor(row.name) }}
                />
                <span>{row.name}</span>
                <strong>
                  {row.share?.toFixed(1) ?? "—"}
                  {row.share !== null && "%"}
                </strong>
                <small>{row.count?.toLocaleString() ?? "—"}</small>
              </div>
            ))}
          </div>
          <p className="distribution-note">
            Advertised client mix, not independent codebase diversity. Zakura
            shares Zebra’s lineage.
          </p>
        </section>
        <div className="analytics-grid">
          <section className="history" aria-labelledby="history-title">
            <div className="section-heading">
              <div>
                <h2 id="history-title">History</h2>
                <p className="section-subtitle">Client share over time</p>
              </div>
              <div className="segmented small" aria-label="History time window">
                {(["7d", "30d"] as const).map((value) => (
                  <button
                    key={value}
                    aria-pressed={period === value}
                    onClick={() => setPeriod(value)}
                  >
                    {value === "7d" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>
            </div>
            {(error || payload?.history.error) && (
              <p role="status" className="inline-warning">
                {history.length
                  ? "Last available history. "
                  : "History unavailable. "}
                {error ?? payload?.history.error}
              </p>
            )}
            {busy && !history.length ? (
              <div className="chart-loading" aria-label="Loading history">
                Loading source observations…
              </div>
            ) : (
              <HistoryChart points={history} />
            )}
            {history.length > 0 && (
              <p className="fine-print">
                {new Date(history[0].at).toLocaleDateString()}–
                {new Date(history[history.length - 1].at).toLocaleDateString()}{" "}
                · {history.length.toLocaleString()} observations · Census v3.
                Available coverage may be shorter than the requested window.
              </p>
            )}
          </section>
          <ClientTable
            census={census}
            versions={view === "versions"}
            filter={filter}
            setFilter={setFilter}
          />
        </div>
        <Methodology census={census} />
      </main>
      <footer className="site-footer">
        <div>
          <span>Zcash observatory</span>
          <span>
            Independent view · Data by{" "}
            <a
              href="https://zecblock.com/docs"
              target="_blank"
              rel="noreferrer"
            >
              ZecBlock
            </a>
          </span>
        </div>
        <a href={repository}>
          Open source <ArrowUpRight size={14} />
        </a>
      </footer>
    </>
  );
}
export default App;
