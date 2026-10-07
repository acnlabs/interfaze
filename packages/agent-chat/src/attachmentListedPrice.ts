/** The file badge is a charge that has already settled, not a price tag.
 * A hold only freezes the balance, so it must not show the badge.
 * Files added after that charge are not covered by it.
 */
export function attachmentListedPriceVisible(piece: unknown): boolean {
  if (!piece || typeof piece !== "object" || Array.isArray(piece)) return false;
  const rec = piece as { status?: unknown; amount?: unknown };
  const status = typeof rec.status === "string" ? rec.status : "";
  const amount = Number(rec.amount);
  if (status !== "captured") return false;
  return Number.isFinite(amount) && amount > 0;
}

/** ``null`` means an older message that did not record which files were billed. */
export function attachmentBilledRefs(piece: unknown): string[] | null {
  if (!piece || typeof piece !== "object" || Array.isArray(piece)) return null;
  const refs = (piece as { billed_refs?: unknown }).billed_refs;
  if (!Array.isArray(refs)) return null;
  return refs.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function attachmentFileBadgeVisible(piece: unknown, mailboxId: string): boolean {
  if (!attachmentListedPriceVisible(piece)) return false;
  const refs = attachmentBilledRefs(piece);
  if (refs == null) return true;
  return refs.includes(mailboxId);
}

export function attachmentSettledVisible(piece: unknown, mailboxIds: string[]): boolean {
  if (!attachmentListedPriceVisible(piece)) return false;
  const refs = attachmentBilledRefs(piece);
  if (refs == null) return true;
  return mailboxIds.some((id) => refs.includes(id));
}
