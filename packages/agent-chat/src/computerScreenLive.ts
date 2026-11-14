/** A ticketed picture is refreshed before the ticket dies. A desktop with no ticket stays up. */

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
  if (exp == null) return false;
  return exp - nowSeconds <= leadSeconds;
}

/** Remount only when the desktop actually resized. A China no-op fit must not flash the iframe. */
export function screenFitRemounts(body: { fitted?: unknown } | null | undefined): boolean {
  return body?.fitted === true;
}

/** GET /screen/stream may 503 when the supplier blips. Do not retry POST /screen. */
export function screenStreamRetries(status: number, attempt: number): boolean {
  return status === 503 && attempt === 0;
}

/** After the picture is hidden or closed, pause once this quiet stretch passes. */
export const SCREEN_AWAY_PAUSE_MS = 60_000;

export function screenStayAwake(visibilityState: string): boolean {
  return visibilityState === "visible";
}

export function screenSliceEnded(status: number, detail: unknown): boolean {
  return status === 409 && detail === "screen slice ended";
}

/** Whole minutes still paid for, counting down from the last server mark. */
export function screenMinutesLeft(secondsLeft: number, markedAt: number, now: number): number {
  const left = secondsLeft - Math.floor((now - markedAt) / 1000);
  if (left <= 0) return 0;
  return Math.ceil(left / 60);
}

const awayHeldIds = new Set<string>();
const awayHeldListeners = new Set<() => void>();

/** The picture was paused after the viewer left. The next open has to be asked for. */
export function holdScreenAway(computerId: string): void {
  awayHeldIds.add(computerId);
  for (const listener of awayHeldListeners) listener();
}

export function screenAwayHeld(computerId: string): boolean {
  return awayHeldIds.has(computerId);
}

export function releaseScreenAway(computerId: string): void {
  awayHeldIds.delete(computerId);
}

export function subscribeScreenAway(listener: () => void): () => void {
  awayHeldListeners.add(listener);
  return () => {
    awayHeldListeners.delete(listener);
  };
}
