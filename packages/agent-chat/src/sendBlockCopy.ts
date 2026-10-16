/** Chat send is blocked under HTTP code rate_limited. The reason is the message prefix. */

const INSUFFICIENT = "insufficient_credits";
const ON_DEMAND = "on_demand_limit";

export type SendBlockKind = "insufficient_credits" | "on_demand_limit" | "rate_limited";

export type SendBlockCopy = {
  insufficientCredits: string;
  onDemandLimitReached: string;
  rateLimited: string;
};

function prefix(message: string | null | undefined): string {
  return (message || "").split(":")[0]?.trim().toLowerCase() ?? "";
}

export function sendBlockKind(
  code: string | null | undefined,
  message: string | null | undefined,
): SendBlockKind | null {
  const normalized = (code || "").trim().toLowerCase();
  if (normalized === INSUFFICIENT || normalized === ON_DEMAND) return normalized;
  if (normalized !== "rate_limited") return null;
  const head = prefix(message);
  if (head === INSUFFICIENT || head === ON_DEMAND) return head;
  return "rate_limited";
}

/** Spoken sentence for a blocked send. Null when this error is something else. */
export function sendBlockSentence(
  code: string | null | undefined,
  message: string | null | undefined,
  copy: SendBlockCopy,
): string | null {
  const kind = sendBlockKind(code, message);
  if (kind === INSUFFICIENT) return copy.insufficientCredits;
  if (kind === ON_DEMAND) return copy.onDemandLimitReached;
  if (kind === "rate_limited") return copy.rateLimited;
  return null;
}
