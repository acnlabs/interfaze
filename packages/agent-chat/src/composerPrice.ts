/** Menu labels. Settlement stays in dollars; China books also carry list yuan. */

export function formatUsdPerMillion(n: number): string {
  return `$${Number(n.toPrecision(6))}`;
}

export function formatCnyPerMillion(n: number): string {
  return `¥${Number(n.toPrecision(6))}`;
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
