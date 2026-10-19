/** USD per million tokens, at most four significant digits. */
export function formatUsdPerMillion(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 1e6) / 1e6;
  return `$${Number(rounded.toPrecision(4))}`;
}
