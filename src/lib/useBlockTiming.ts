import { useCallback, useEffect, useRef, useState } from "react";
import type { Resource } from "./census.ts";
import type { BlockTiming } from "./blockTiming.ts";

export function useBlockTiming() {
  const [resource, setResource] = useState<Resource<BlockTiming> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/block-timing", {
        signal: request.signal,
      });
      if (!response.ok)
        throw new Error(`Block timing request failed (${response.status}).`);
      const body: Resource<BlockTiming> = await response.json();
      if (!("data" in body) || !("error" in body))
        throw new Error("Invalid block timing response.");
      // The service decides when an old day must be discarded; do not restore it.
      setResource(body);
    } catch (cause) {
      if (request.signal.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Cannot reach block timing data.",
      );
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
  }, [refresh]);
  return { resource, busy, error, refresh };
}
