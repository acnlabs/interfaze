/** The file badge is a charge the viewer already owes, not a price tag.
 * Own-agent hops skip the charge, so they must not show it.
 */
export function attachmentListedPriceVisible(piece: unknown): boolean {
  if (!piece || typeof piece !== "object" || Array.isArray(piece)) return false;
  const rec = piece as { status?: unknown; amount?: unknown };
  const status = typeof rec.status === "string" ? rec.status : "";
  const amount = Number(rec.amount);
  if (status !== "captured" && status !== "held") return false;
  return Number.isFinite(amount) && amount > 0;
}
