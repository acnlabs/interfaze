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
  const amount = menuAmount(option, side);
  if (!amount) return null;
  return amount.currency === "CNY" ? formatCnyPerMillion(amount.value) : formatUsdPerMillion(amount.value);
}

/**
 * Composer chip. Three decimals from one cent up ($0.04843 → $0.048, $0.102 → $0.102)
 * so nearby cheap models stay distinct. Below one cent, three significant digits.
 * Dollars and above use two decimals ($1.533 → $1.53).
 */
function shortRateBody(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs === 0) return "0";
  const body =
    abs < 0.01
      ? String(Number(abs.toPrecision(3)))
      : abs < 1
        ? trimTrailingZeros(abs.toFixed(3))
        : trimTrailingZeros(abs.toFixed(2));
  return `${sign}${body}`;
}

function trimTrailingZeros(fixed: string): string {
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function formatUsdPerMillionShort(n: number): string {
  return `$${shortRateBody(n)}`;
}

export function formatCnyPerMillionShort(n: number): string {
  return `¥${shortRateBody(n)}`;
}

export function formatLocalPerMillionShort(n: number, currency?: string | null): string {
  return (currency || "").toUpperCase() === "CNY"
    ? formatCnyPerMillionShort(n)
    : formatUsdPerMillionShort(n);
}

/** Same currency rule as formatMenuSide, at chip precision. */
export function formatMenuSideShort(option: MenuRate, side: "input" | "output"): string | null {
  const amount = menuAmount(option, side);
  if (!amount) return null;
  return amount.currency === "CNY"
    ? formatCnyPerMillionShort(amount.value)
    : formatUsdPerMillionShort(amount.value);
}

function menuAmount(
  option: MenuRate,
  side: "input" | "output",
): { value: number; currency: "CNY" | "USD" } | null {
  const cnyIn = option.input_price_cny_per_million;
  const cnyOut = option.output_price_cny_per_million;
  if (typeof cnyIn === "number" && typeof cnyOut === "number") {
    return { value: side === "input" ? cnyIn : cnyOut, currency: "CNY" };
  }
  const usd = side === "input" ? option.input_price_per_million : option.output_price_per_million;
  return typeof usd === "number" ? { value: usd, currency: "USD" } : null;
}
