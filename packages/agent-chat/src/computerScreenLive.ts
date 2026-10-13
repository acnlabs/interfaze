/** The live iframe bakes a one-hour HMAC ticket. Refresh before it dies. */

export const SCREEN_TICKET_LEAD_SECONDS = 300;

export function screenLiveTicketExp(url: string): number | null {
  try {
    const raw = new URL(url).searchParams.get("ticket") || "";
    const exp = Number(raw.split(".")[0]);
    if (!Number.isFinite(exp) || exp <= 0) return null;
    return exp;
  } catch {
    return null;
  }
}

export function screenLiveNeedsRefresh(
  url: string,
  nowSeconds = Date.now() / 1000,
  leadSeconds = SCREEN_TICKET_LEAD_SECONDS,
): boolean {
  const exp = screenLiveTicketExp(url);
  if (exp == null) return true;
  return exp - nowSeconds <= leadSeconds;
}
