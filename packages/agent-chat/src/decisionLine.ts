/** A user turn that auto-decide sent. The label stays in `content` for the agent. */
export function isAutoDecisionMessage(message: {
  sender_type?: string | null;
  content?: string | null;
  metadata?: object | null;
}): boolean {
  if (message.sender_type !== "user") return false;
  const metadata = message.metadata;
  if (!metadata || !("decision" in metadata)) return false;
  const raw = (metadata as { decision?: unknown }).decision;
  if (!raw || typeof raw !== "object") return false;
  if ((raw as { auto?: unknown }).auto !== true) return false;
  return typeof message.content === "string" && message.content.trim().length > 0;
}

/** Centered transcript line. The chat does not show this turn as the user's own words. */
export function decisionAutoLine(locale: string | null | undefined, label: string): string {
  const text = label.trim();
  const zh = (locale || "").toLowerCase().startsWith("zh");
  if (zh) return `自动决策选了「${text}」`;
  return `Auto-decide picked “${text}”.`;
}
