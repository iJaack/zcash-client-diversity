import { HISTORY_PLOT } from "./history.ts";

export interface ObservationSelection {
  time: number;
  /** Source-order position among observations sharing this timestamp. */
  occurrence: number;
}

/** Selects an existing observation in a sorted timeline, never an interpolated value. */
export function nearestObservationIndex(
  times: readonly number[],
  requested: number,
): number | null {
  if (!times.length || !Number.isFinite(requested)) return null;
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] < requested) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  if (low === times.length) return times.length - 1;
  // Earlier observation wins an exact midpoint, including across a source gap.
  return requested - times[low - 1] <= times[low] - requested ? low - 1 : low;
}

/** Retains equal-time observations as distinct keyboard/range selections. */
export function observationSelectionAtIndex(
  times: readonly number[],
  index: number,
): ObservationSelection | null {
  if (!Number.isInteger(index) || index < 0 || index >= times.length)
    return null;
  const time = times[index];
  const first = nearestObservationIndex(times, time);
  return first === null ? null : { time, occurrence: index - first };
}

/** Reanchors a selection when refreshed/ranged data inserts or removes samples. */
export function resolveObservationSelection(
  times: readonly number[],
  selection: ObservationSelection,
): number | null {
  const first = nearestObservationIndex(times, selection.time);
  if (first === null || times[first] !== selection.time) return first;
  let low = first;
  let high = times.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] <= selection.time) low = middle + 1;
    else high = middle;
  }
  return Math.min(first + selection.occurrence, low - 1);
}

/** Converts an SVG plot coordinate to time; CSS scaling and scrolling are handled by the caller. */
export function historyTimeAtX(
  x: number,
  start: number,
  end: number,
): number | null {
  if (![x, start, end].every(Number.isFinite) || end < start) return null;
  const fraction = Math.max(
    0,
    Math.min(
      1,
      (x - HISTORY_PLOT.left) / (HISTORY_PLOT.right - HISTORY_PLOT.left),
    ),
  );
  return start + fraction * (end - start);
}
