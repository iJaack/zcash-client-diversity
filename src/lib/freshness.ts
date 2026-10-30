export const OBSERVATION_DELAY_MS = 15 * 60_000;
const CLOCK_TOLERANCE_MS = 2 * 60_000;

/** Age describes the source timestamp, never the time a cached response arrived. */
export function observationFreshness(timestamp: string, now: number) {
  const elapsed = now - Date.parse(timestamp);
  if (!Number.isFinite(elapsed))
    return { ageLabel: "Age unavailable", delayed: false, clockSkew: false };
  if (elapsed < -CLOCK_TOLERANCE_MS)
    return {
      ageLabel: "Timestamp ahead of device clock",
      delayed: false,
      clockSkew: true,
    };

  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const ageLabel =
    days > 0
      ? `${days} ${days === 1 ? "day" : "days"} old`
      : hours > 0
        ? `${hours} hr${minutes % 60 ? ` ${minutes % 60} min` : ""} old`
        : minutes > 0
          ? `${minutes} min old`
          : "Less than a minute old";
  return {
    ageLabel,
    delayed: elapsed > OBSERVATION_DELAY_MS,
    clockSkew: false,
  };
}
