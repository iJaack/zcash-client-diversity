/** A common zero-based scale for signed block-header intervals. */
export function intervalBarLayout(values: readonly (number | null)[]) {
  const available = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const minimum = Math.min(0, ...available);
  const maximum = Math.max(0, ...available);
  // Normalize first so even finite values at opposite extremes do not overflow.
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum)) || 1;
  const start = minimum / scale;
  const span = maximum / scale - start || 1;
  const position = (value: number) => ((value / scale - start) / span) * 100;
  const zero = position(0);
  return {
    minimum,
    maximum,
    hasValues: available.length > 0,
    zero,
    bars: values.map((value) => {
      if (value === null || !Number.isFinite(value)) return null;
      const end = position(value);
      return { left: Math.min(zero, end), width: Math.abs(end - zero) };
    }),
  };
}
