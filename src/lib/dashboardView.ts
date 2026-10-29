import type { Census } from "./census.ts";

export type DashboardView = {
  period: "7d" | "30d";
  view: "distribution" | "versions";
  client: string;
  sort: "nodes" | "client";
  order: "asc" | "desc";
  metric: "mean" | "median" | "p90";
};

export const defaultView: DashboardView = {
  period: "7d",
  view: "distribution",
  client: "all",
  sort: "nodes",
  order: "desc",
  metric: "mean",
};

/** Bound URL state independently of the provider's evolving client categories. */
export function parseDashboardView(search: string): DashboardView {
  const params = new URLSearchParams(search);
  const client = params.get("client")?.trim();
  return {
    period: params.get("period") === "30d" ? "30d" : "7d",
    view: params.get("view") === "versions" ? "versions" : "distribution",
    client:
      client && client.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(client)
        ? client
        : "all",
    sort: params.get("sort") === "client" ? "client" : "nodes",
    order: params.get("order") === "asc" ? "asc" : "desc",
    metric:
      params.get("metric") === "median"
        ? "median"
        : params.get("metric") === "p90"
          ? "p90"
          : "mean",
  };
}

export function dashboardViewSearch(view: DashboardView): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(defaultView) as (keyof DashboardView)[]) {
    if (view[key] !== defaultView[key]) params.set(key, view[key]);
  }
  return params.size ? `?${params}` : "";
}

function sortClientRows<T extends { count: number }>(
  rows: readonly T[],
  name: (row: T) => string,
  sort: DashboardView["sort"],
  order: DashboardView["order"],
): T[] {
  const direction = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const labelOrder = name(a).localeCompare(name(b), "en", { numeric: true });
    return sort === "client"
      ? direction * labelOrder
      : direction * (a.count - b.count) || labelOrder;
  });
}
/** One selection feeds the table and CSV; shares keep the full source denominator. */
export function selectCensusRows(
  census: Census,
  { view, client, sort, order }: DashboardView,
): Pick<Census, "clients" | "versions"> {
  return {
    clients:
      view === "distribution"
        ? sortClientRows(
            census.clients.filter(
              (row) => client === "all" || row.name === client,
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
              (row) => client === "all" || row.client === client,
            ),
            (row) => `${row.client}/${row.version}`,
            sort,
            order,
          )
        : [],
  };
}
