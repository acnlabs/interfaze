/** Screen text for Credits. The ledger keeps micros; these strings are rounded. */

const MICROS_PER_CREDIT = 1_000_000;

function grouped(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Half-up to 0.01 credit. Integer micros, so 0.145 does not fall to 0.14. */
function formatFromMicros(totalMicros: number): string {
  const sign = totalMicros < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(totalMicros));
  const cents = Math.floor((abs + 5_000) / 10_000);
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${sign}${grouped(String(whole))}.${frac}`;
}

export function formatCreditBalance(balance: number, micros = 0): string {
  const whole = Math.trunc(balance);
  const fractionMicros = Math.round((balance - whole) * MICROS_PER_CREDIT);
  return formatFromMicros(whole * MICROS_PER_CREDIT + fractionMicros + Math.trunc(micros || 0));
}

export function formatWholeCredits(amount: number): string {
  const n = Math.trunc(amount);
  const sign = n < 0 ? "-" : "";
  return `${sign}${grouped(String(Math.abs(n)))}`;
}

/** Local currency per some quantity → credit text at 2 decimals.

One credit is ``rate`` of that currency (0.01 in production: one fen or one cent).
A short amount stays a fraction. It is not rounded up to 1 credit.
*/
export function formatCreditsFromLocal(localAmount: number, rate = 0.01): string {
  if (!Number.isFinite(localAmount) || localAmount <= 0 || !(rate > 0)) {
    return formatFromMicros(0);
  }
  const millionths = Math.round(localAmount * 1_000_000);
  const microsPerMillionth = Math.round(MICROS_PER_CREDIT / (rate * 1_000_000));
  return formatFromMicros(millionths * microsPerMillionth);
}

/** Chat hops are stored in micros. Top-ups and withdrawals stay whole credits. */
export function formatLedgerAmount(amount: number, unit?: string | null): string {
  if (unit === "micros") return formatFromMicros(Math.trunc(amount));
  return formatWholeCredits(amount);
}

/** A charge is stored as a positive number. ``direction`` says whether it left. */
export function formatSignedCreditAmount(
  amount: number,
  unit?: string | null,
  direction?: string | null,
): string {
  const text = formatLedgerAmount(Math.abs(amount), unit);
  if (direction === "out" || (direction !== "in" && amount < 0)) return `-${text}`;
  if (direction === "in" || amount > 0) return `+${text}`;
  return text;
}
