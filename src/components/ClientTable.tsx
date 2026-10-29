import type { Census, ClientRow, VersionRow } from "../lib/census.ts";
import { clientColor } from "../lib/colors.ts";
import type { DashboardView } from "../lib/dashboardView.ts";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
export default function ClientTable({
  census,
  rows,
  filter,
  setFilter,
  versions,
  sort,
  order,
  onSort,
}: {
  census: Census | null;
  rows: readonly (ClientRow | VersionRow)[];
  filter: string;
  setFilter: (value: string) => void;
  versions: boolean;
  sort: DashboardView["sort"];
  order: DashboardView["order"];
  onSort: (column: DashboardView["sort"]) => void;
}) {
  const clients = census?.clients ?? [];
  const sortIcon = (column: DashboardView["sort"]) =>
    sort !== column ? (
      <ArrowUpDown size={13} />
    ) : order === "asc" ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    );
  return (
    <section className="breakdown" aria-labelledby="breakdown-title">
      <div className="section-heading">
        <h2 id="breakdown-title">
          {versions ? "Reported versions" : "Client breakdown"}
        </h2>
      </div>
      <label className="filter-label">
        Show client
        <select
          aria-label="Filter client table"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All clients</option>
          {filter !== "all" && !clients.some((row) => row.name === filter) && (
            <option value={filter}>
              {filter} ({census ? "not in latest sample" : "no current sample"})
            </option>
          )}
          {clients.map((row) => (
            <option key={row.name}>{row.name}</option>
          ))}
        </select>
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th
                aria-sort={
                  sort === "client"
                    ? order === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  className="sort-button"
                  onClick={() => onSort("client")}
                >
                  Client{versions ? " / version" : ""} {sortIcon("client")}
                </button>
              </th>
              <th
                className="numeric"
                aria-sort={
                  sort === "nodes"
                    ? order === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button className="sort-button" onClick={() => onSort("nodes")}>
                  Nodes {sortIcon("nodes")}
                </button>
              </th>
              <th className="numeric">Share</th>
            </tr>
          </thead>
          <tbody>
            {census
              ? rows.map((row) => {
                  const name = "name" in row ? row.name : row.client;
                  return (
                    <tr
                      key={
                        "version" in row
                          ? `${row.client}/${row.version}`
                          : row.name
                      }
                    >
                      <th scope="row">
                        <span className="client-name">
                          <i
                            className="dot"
                            style={{ backgroundColor: clientColor(name) }}
                          />
                          {name}
                        </span>
                        {"version" in row && (
                          <span className="version-label">{row.version}</span>
                        )}
                      </th>
                      <td className="numeric">{row.count.toLocaleString()}</td>
                      <td className="numeric">
                        {("share" in row
                          ? row.share
                          : census.total
                            ? (row.count / census.total) * 100
                            : 0
                        ).toFixed(1)}
                        %
                      </td>
                    </tr>
                  );
                })
              : ["Zebra", "Zakura", "zcashd", "Unknown"].map((name) => (
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
                    <td className="numeric">—</td>
                    <td className="numeric">—</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {census && rows.length === 0 && (
        <p className="empty-copy">
          No {versions ? "top-version entries" : "clients"} match this filter.
        </p>
      )}
      <p className="fine-print">
        {versions
          ? "Top 12 client/version pairs returned by the source. Shares use all observed IPs; rows may not sum to 100%."
          : "Share of all observed active IPs, including seeders and unidentified peers. Client names are self-reported."}
      </p>
    </section>
  );
}
