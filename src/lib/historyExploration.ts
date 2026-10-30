import type { HistoryPoint } from "./census.ts";

export type HistoryZoom = "full" | "24h" | "6h";

/** Zoom is anchored to the latest source observation, even when the source is delayed. */
export function historyWindow(
  points: readonly HistoryPoint[],
  zoom: HistoryZoom,
): HistoryPoint[] {
  const ordered = points
    .filter((point) => Number.isFinite(Date.parse(point.at)))
    .slice()
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  if (zoom === "full" || !ordered.length) return ordered;
  const cutoff =
    Date.parse(ordered.at(-1)!.at) -
    (zoom === "24h" ? 24 : 6) * 60 * 60 * 1_000;
  return ordered.filter((point) => Date.parse(point.at) >= cutoff);
}

/** A refreshed baseline must still describe the same complete source record. */
export function resolvePinnedObservation(
  points: readonly HistoryPoint[],
  pinned: HistoryPoint | null,
): HistoryPoint | null {
  if (!pinned) return null;
  return (
    points.find(
      (point) =>
        point.at === pinned.at &&
        point.censusVersion === pinned.censusVersion &&
        point.total === pinned.total &&
        point.clients.length === pinned.clients.length &&
        point.clients.every((client) =>
          pinned.clients.some(
            (other) =>
              client.name === other.name &&
              client.count === other.count &&
              client.share === other.share,
          ),
        ),
    ) ?? null
  );
}

export function compareObservations(
  baseline: HistoryPoint,
  selected: HistoryPoint,
) {
  const reason =
    baseline.censusVersion !== selected.censusVersion
      ? "These observations use different census versions. Their changes are not comparable."
      : baseline.total <= 0 || selected.total <= 0
        ? "One of these observations has no measured population. Changes are unavailable."
        : null;
  const names = [
    ...new Set([
      ...selected.clients.map((client) => client.name),
      ...baseline.clients.map((client) => client.name),
    ]),
  ];
  return {
    reason,
    rows: names.map((name) => {
      const before = baseline.clients.find((client) => client.name === name);
      const after = selected.clients.find((client) => client.name === name);
      const measured =
        !reason &&
        before &&
        after &&
        [before, after].every(
          (client) =>
            Number.isFinite(client.count) &&
            client.count >= 0 &&
            Number.isFinite(client.share) &&
            client.share >= 0 &&
            client.share <= 100,
        );
      return {
        name,
        countChange: measured ? after.count - before.count : null,
        shareChange: measured ? after.share - before.share : null,
      };
    }),
  };
}
