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

/** Judgment call recorded on the decision event, not on the agent reply. */
export function decisionUsageFromMessage(message: {
  metadata?: object | null;
}): { modelId: string | null; input: number } | null {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const decision = (metadata as { decision?: unknown }).decision;
  if (!decision || typeof decision !== "object") return null;
  const input = Number((decision as { input_tokens?: unknown }).input_tokens);
  if (!Number.isFinite(input) || input <= 0) return null;
  const model = (decision as { model?: unknown }).model;
  const modelId = typeof model === "string" && model.trim() ? model.trim() : null;
  return { modelId, input: Math.trunc(input) };
}

/** Centered transcript line for one decision-model call. */
export function decisionEventLine(
  locale: string | null | undefined,
  message: {
    sender_type?: string | null;
    content?: string | null;
    metadata?: object | null;
  },
): string {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object" || !("decision" in metadata)) return "";
  const decision = (metadata as { decision?: unknown }).decision;
  if (!decision || typeof decision !== "object") return "";
  if ((decision as { auto?: unknown }).auto !== true) return "";
  const zh = (locale || "").toLowerCase().startsWith("zh");
  if ((decision as { event?: unknown }).event === "stopped") {
    return zh ? "自动决策停住了。" : "Auto-decide stopped.";
  }
  if (message.sender_type !== "user") return "";
  const label = typeof message.content === "string" ? message.content.trim() : "";
  if (!label) return "";
  return decisionAutoLine(locale, label);
}

/** Centered transcript line. The chat does not show this turn as the user's own words. */
export function decisionAutoLine(locale: string | null | undefined, label: string): string {
  const text = label.trim();
  const zh = (locale || "").toLowerCase().startsWith("zh");
  if (zh) return `自动决策选了「${text}」`;
  return `Auto-decide picked “${text}”.`;
}
