/** The file badge is a charge that has already settled, not a price tag.
 * A hold only freezes the balance, so it must not show the badge.
 */
export function attachmentListedPriceVisible(piece: unknown): boolean {
  if (!piece || typeof piece !== "object" || Array.isArray(piece)) return false;
  const rec = piece as { status?: unknown; amount?: unknown };
  const status = typeof rec.status === "string" ? rec.status : "";
  const amount = Number(rec.amount);
  if (status !== "captured") return false;
  return Number.isFinite(amount) && amount > 0;
}
