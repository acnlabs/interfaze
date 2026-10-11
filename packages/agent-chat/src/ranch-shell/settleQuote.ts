/** Matches backend `settle_quote`. Fee default is the host's 10% usage cut. */

export const DEFAULT_CHAT_FEE_RATE = 0.1;

function roundUsd(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function chatSettleQuote(
  baseIn: number,
  baseOut: number,
  markupPercent: number,
  official: boolean,
  feeRate: number = DEFAULT_CHAT_FEE_RATE,
): { hunterIn: number; hunterOut: number; ownerIn: number; ownerOut: number } {
  const rate = Math.min(0.99, Math.max(0, Number(feeRate) || 0));
  const denom = 1 - rate > 0 ? 1 - rate : 1;
  const gross = (net: number) => (net > 0 ? net / denom : 0);
  if (official) {
    const pct = Math.max(0, markupPercent) / 100;
    const ownerIn = baseIn * pct;
    const ownerOut = baseOut * pct;
    return {
      ownerIn: roundUsd(ownerIn),
      ownerOut: roundUsd(ownerOut),
      hunterIn: roundUsd(baseIn + gross(ownerIn)),
      hunterOut: roundUsd(baseOut + gross(ownerOut)),
    };
  }
  const ownerIn = baseIn * (1 + markupPercent / 100);
  const ownerOut = baseOut * (1 + markupPercent / 100);
  return {
    ownerIn: roundUsd(ownerIn),
    ownerOut: roundUsd(ownerOut),
    hunterIn: roundUsd(gross(ownerIn)),
    hunterOut: roundUsd(gross(ownerOut)),
  };
}
