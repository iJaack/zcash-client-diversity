import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardPayload } from "./census.ts";
export function useDashboard(period: "7d" | "30d") {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const loadedPeriod = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError(null);
    if (loadedPeriod.current !== period)
      setPayload((previous) =>
        previous
          ? { ...previous, history: { data: null, error: null, cached: false } }
          : null,
      );
    try {
      const response = await fetch(`/api/dashboard?period=${period}`, {
        signal: request.signal,
      });
      if (!response.ok)
        throw new Error(`Dashboard request failed (${response.status}).`);
      const body: DashboardPayload = await response.json();
      if (!body.current || !body.history)
        throw new Error("The dashboard returned an invalid response.");
      setPayload((previous) => ({
        ...body,
        current: body.current.data
          ? body.current
          : {
              ...body.current,
              data: previous?.current.data ?? null,
              cached: Boolean(previous?.current.data),
            },
        // A null server history can explicitly revoke methodological comparability.
        // Ordinary upstream outages already retain the server's last good resource.
        history: body.history,
      }));
      loadedPeriod.current = period;
    } catch (cause) {
      if (request.signal.aborted) return;
      setError(
        cause instanceof Error ? cause.message : "Cannot reach the dashboard.",
      );
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }, [period]);
  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, [refresh]);
  return { payload, busy, error, refresh };
}
