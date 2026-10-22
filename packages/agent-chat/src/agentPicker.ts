const OPAQUE_ID =
  /^(?:acn:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runtimes that say they do not chat or do not do work cannot be picked. */
export function agentRefusesChat(description: string | null | undefined): boolean {
  const text = (description || "").trim().toLowerCase();
  if (!text) return false;
  return (
    text.includes("does not chat") ||
    text.includes("does not execute") ||
    text.includes("不聊天") ||
    text.includes("不执行")
  );
}

export function agentPickerSubtitle(
  agentId: string,
  description: string | null | undefined,
  emptyLabel: string,
): string {
  const text = (description || "").trim();
  if (!text || text === agentId.trim() || OPAQUE_ID.test(text)) return emptyLabel;
  return text;
}
