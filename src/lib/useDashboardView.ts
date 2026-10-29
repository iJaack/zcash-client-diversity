import { useEffect, useState } from "react";
import {
  dashboardViewSearch,
  parseDashboardView,
  type DashboardView,
} from "./dashboardView.ts";

export function useDashboardView() {
  const [state, setState] = useState(() =>
    parseDashboardView(window.location.search),
  );
  useEffect(() => {
    const restore = () => setState(parseDashboardView(window.location.search));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const update = (changes: Partial<DashboardView>) => {
    const next = { ...parseDashboardView(window.location.search), ...changes };
    const search = dashboardViewSearch(next);
    const current = dashboardViewSearch(
      parseDashboardView(window.location.search),
    );
    if (search === current) return;
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
    setState(next);
  };
  return [state, update] as const;
}
