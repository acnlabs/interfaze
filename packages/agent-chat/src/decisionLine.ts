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

/** Judgment call on the agent reply that triggered it. Output tokens are not billed. */
export function decisionUsageFromMessage(message: {
  metadata?: object | null;
}): { modelId: string | null; input: number } | null {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const orchestration = (metadata as { orchestration?: unknown }).orchestration;
  if (!orchestration || typeof orchestration !== "object") return null;
  const decide = (orchestration as { decide?: unknown }).decide;
  if (!decide || typeof decide !== "object") return null;
  const shadow = (decide as { shadow?: unknown }).shadow;
  if (!shadow || typeof shadow !== "object") return null;
  const usage = (shadow as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;
  const input = Number((usage as { input_tokens?: unknown }).input_tokens);
  if (!Number.isFinite(input) || input <= 0) return null;
  const model = (shadow as { model?: unknown }).model;
  const modelId = typeof model === "string" && model.trim() ? model.trim() : null;
  return { modelId, input: Math.trunc(input) };
}

/** Centered transcript line. The chat does not show this turn as the user's own words. */
export function decisionAutoLine(locale: string | null | undefined, label: string): string {
  const text = label.trim();
  const zh = (locale || "").toLowerCase().startsWith("zh");
  if (zh) return `自动决策选了「${text}」`;
  return `Auto-decide picked “${text}”.`;
}
