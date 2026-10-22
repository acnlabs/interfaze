/** Menu labels. Settlement stays in dollars; China books also carry list yuan. */

/** Four significant digits: $0.3833, $1.533, ¥4. Enough to compare models, not a ledger. */
export function formatUsdPerMillion(n: number): string {
  return `$${Number(n.toPrecision(4))}`;
}

export function formatCnyPerMillion(n: number): string {
  return `¥${Number(n.toPrecision(4))}`;
}

export function formatLocalPerMillion(n: number, currency?: string | null): string {
  return (currency || "").toUpperCase() === "CNY" ? formatCnyPerMillion(n) : formatUsdPerMillion(n);
}

export type MenuRate = {
  input_price_per_million?: number;
  output_price_per_million?: number;
  input_price_cny_per_million?: number;
  output_price_cny_per_million?: number;
};

/** Print yuan when the option has both CNY rates. Otherwise print dollars. */
export function formatMenuSide(option: MenuRate, side: "input" | "output"): string | null {
  const cnyIn = option.input_price_cny_per_million;
  const cnyOut = option.output_price_cny_per_million;
  if (typeof cnyIn === "number" && typeof cnyOut === "number") {
    return formatCnyPerMillion(side === "input" ? cnyIn : cnyOut);
  }
  const usd = side === "input" ? option.input_price_per_million : option.output_price_per_million;
  return typeof usd === "number" ? formatUsdPerMillion(usd) : null;
}
