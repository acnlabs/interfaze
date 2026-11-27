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

export type DecisionCallUsage = { modelId: string | null; input: number | null };

function decisionRecord(message: { metadata?: object | null }): Record<string, unknown> | null {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object" || !("decision" in metadata)) return null;
  const decision = (metadata as { decision?: unknown }).decision;
  if (!decision || typeof decision !== "object") return null;
  return decision as Record<string, unknown>;
}

function usagePair(model: unknown, input: unknown): DecisionCallUsage | null {
  const modelId = typeof model === "string" && model.trim() ? model.trim() : null;
  const tokens = Number(input);
  const counted = Number.isFinite(tokens) && tokens > 0 ? Math.trunc(tokens) : null;
  if (!modelId && counted == null) return null;
  return { modelId, input: counted };
}

/** Model and input stored on the agent reply that was judged. */
export function judgmentMark(message: {
  metadata?: object | null;
}): DecisionCallUsage | null {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const orchestration = (metadata as { orchestration?: unknown }).orchestration;
  if (!orchestration || typeof orchestration !== "object") return null;
  const decide = (orchestration as { decide?: unknown }).decide;
  if (!decide || typeof decide !== "object") return null;
  const shadow = (decide as { shadow?: unknown }).shadow;
  if (!shadow || typeof shadow !== "object") return null;
  const usage = (shadow as { usage?: unknown }).usage;
  const input =
    usage && typeof usage === "object" ? (usage as { input_tokens?: unknown }).input_tokens : null;
  return usagePair((shadow as { model?: unknown }).model, input);
}

/** Usage on a decision event. Older events borrow it from the reply that was judged. */
export function decisionCallUsage(
  message: { metadata?: object | null },
  thread: ReadonlyArray<{ message_id?: string | null; metadata?: object | null }>,
): DecisionCallUsage | null {
  const decision = decisionRecord(message);
  if (decision) {
    const own = usagePair(decision.model, decision.input_tokens);
    if (own) return own;
    const sourceId = typeof decision.source_message_id === "string" ? decision.source_message_id : "";
    if (sourceId) {
      const source = thread.find((item) => item.message_id === sourceId);
      if (source) return judgmentMark(source);
    }
  }
  return null;
}

/** A judged reply with no sent or stopped line still needs the stopped event. */
export function judgmentNeedsStoppedLine(
  message: { message_id?: string | null; sender_type?: string | null; metadata?: object | null },
  thread: ReadonlyArray<{ metadata?: object | null }>,
): boolean {
  if (message.sender_type === "user" || message.sender_type === "system") return false;
  if (!judgmentMark(message)) return false;
  const id = message.message_id || "";
  if (!id) return false;
  return !thread.some((item) => {
    const decision = decisionRecord(item);
    return decision?.auto === true && decision.source_message_id === id;
  });
}

export function decisionStoppedLine(locale: string | null | undefined): string {
  return (locale || "").toLowerCase().startsWith("zh") ? "自动决策停住了。" : "Auto-decide stopped.";
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
  if ((decision as { event?: unknown }).event === "stopped") {
    return decisionStoppedLine(locale);
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
