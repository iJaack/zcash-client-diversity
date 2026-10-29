import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Download,
  Link2,
  RefreshCw,
  X,
} from "lucide-react";
import { useDashboard } from "./lib/useDashboard.ts";
import { csvForCensus } from "./lib/census.ts";
import { clientColor } from "./lib/colors.ts";
import BlockTiming from "./components/BlockTiming.tsx";
import { useBlockTiming } from "./lib/useBlockTiming.ts";
import ClientTable from "./components/ClientTable.tsx";
import HistoryChart from "./components/HistoryChart.tsx";
import Methodology from "./components/Methodology.tsx";
import { useDashboardView } from "./lib/useDashboardView.ts";
import {
  dashboardViewSearch,
  parseDashboardView,
  sortClientRows,
} from "./lib/dashboardView.ts";
const repository = "https://github.com/iJaack/zcash-client-diversity";
function currentViewUrl() {
  return `${window.location.origin}${window.location.pathname}${dashboardViewSearch(parseDashboardView(window.location.search))}`;
}
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
  const [dashboardView, updateView] = useDashboardView();
  const { period, view, client: filter, sort, order, metric } = dashboardView;
  const [sharing, setSharing] = useState<"idle" | "copied" | "manual">("idle");
  const shareUrl = currentViewUrl();
  useEffect(() => setSharing("idle"), [dashboardView]);
  useEffect(() => {
    if (sharing !== "copied") return;
    const timer = setTimeout(() => setSharing("idle"), 3000);
    return () => clearTimeout(timer);
  }, [sharing]);
  const focusClient = (client: string) =>
    updateView({ client: filter === client ? "all" : client });
  const shareView = async () => {
    const requestedUrl = currentViewUrl();
    let result: "copied" | "manual";
    try {
      await navigator.clipboard.writeText(requestedUrl);
      result = "copied";
    } catch {
      result = "manual";
    }
    if (currentViewUrl() === requestedUrl) setSharing(result);
  };
  const { payload, busy, error, refresh } = useDashboard(period);
  const timing = useBlockTiming();
  const refreshing = busy || timing.busy;
  const census = payload?.current.data ?? null;
  const focused = census?.clients.find((row) => row.name === filter);
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
              ? sortClientRows(
                  census.clients.filter(
                    (row) => filter === "all" || row.name === filter,
                  ),
                  (row) => row.name,
                  sort,
                  order,
                )
              : [],
          versions:
            view === "versions"
              ? sortClientRows(
                  census.versions.filter(
                    (row) => filter === "all" || row.client === filter,
                  ),
                  (row) => `${row.client}/${row.version}`,
                  sort,
                  order,
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
            <span>ZecLens</span>
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
              className="button secondary"
              onClick={() => void shareView()}
            >
              {sharing === "copied" ? <Check size={15} /> : <Link2 size={15} />}
              {sharing === "copied" ? "Link copied" : "Share view"}
            </button>
            <button
              className="button primary"
              onClick={() => {
                void Promise.allSettled([refresh(), timing.refresh()]);
              }}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        {sharing === "manual" && (
          <label className="share-fallback">
            Copy this view link
            <input
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
        <span className="sr-only" role="status">
          {sharing === "copied" ? "View link copied to clipboard." : ""}
        </span>
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
                onClick={() => updateView({ view: "distribution" })}
              >
                Distribution
              </button>
              <button
                aria-pressed={view === "versions"}
                onClick={() => updateView({ view: "versions" })}
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
            role="group"
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
                <button
                  type="button"
                  key={row.name}
                  aria-label={`Focus on ${row.name}: ${row.count} IPs, ${row.share.toFixed(1)} percent`}
                  aria-pressed={filter === row.name}
                  onClick={() => focusClient(row.name)}
                  style={{
                    width: `${row.share}%`,
                    background: clientColor(row.name),
                  }}
                  title={`${row.name}: ${row.share.toFixed(1)}%`}
                >
                  {row.share > 8 && <span>{row.share.toFixed(1)}%</span>}
                </button>
              ))}
          </div>
          <div
            className="distribution-legend"
            aria-label="Focus node views on a client"
          >
            <button
              className="distribution-key all-clients"
              aria-pressed={filter === "all"}
              onClick={() => updateView({ client: "all" })}
            >
              All clients
            </button>
            {(
              census?.clients ??
              ["Zebra", "Zakura", "zcashd", "Unknown"].map((name) => ({
                name,
                count: null,
                share: null,
              }))
            ).map((row) => (
              <button
                key={row.name}
                className="distribution-key"
                aria-pressed={filter === row.name}
                onClick={() => focusClient(row.name)}
                disabled={!census}
              >
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
              </button>
            ))}
          </div>
          <div className="focus-summary" role="status">
            <p>
              {filter === "all" ? (
                "Select a client to focus the history chart and breakdown."
              ) : !census ? (
                <>
                  <strong>{filter}</strong> is selected. No current node sample
                  is available yet.
                </>
              ) : focused ? (
                <>
                  <strong>{focused.name}</strong> ·{" "}
                  {focused.count.toLocaleString()} observed IPs ·{" "}
                  {focused.share.toFixed(1)}% of the full sample. History and
                  breakdown focused.
                </>
              ) : (
                <>
                  <strong>{filter}</strong> is absent from the latest sample.
                  History and breakdown remain focused on this client.
                </>
              )}
            </p>
            {filter !== "all" && (
              <button
                className="clear-focus"
                onClick={() => updateView({ client: "all" })}
              >
                <X size={13} /> Show all clients
              </button>
            )}
          </div>
          <p className="distribution-note">
            Advertised client mix, not independent codebase diversity. Zakura
            shares Zebra’s lineage.
          </p>
        </section>
        <BlockTiming
          resource={timing.resource}
          busy={timing.busy}
          error={timing.error}
          metric={metric}
          onMetricChange={(metric) => updateView({ metric })}
        />
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
                    onClick={() => updateView({ period: value })}
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
              <HistoryChart
                points={history}
                focusedClient={filter}
                onFocusClient={focusClient}
              />
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
            setFilter={(client) => updateView({ client })}
            sort={sort}
            order={order}
            onSort={(column) =>
              updateView({
                sort: column,
                order:
                  sort === column
                    ? order === "asc"
                      ? "desc"
                      : "asc"
                    : column === "client"
                      ? "asc"
                      : "desc",
              })
            }
          />
        </div>
        <Methodology census={census} />
      </main>
      <footer className="site-footer">
        <div>
          <span>ZecLens</span>
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
