export type InboxChat = {
  chat_id: string;
  type?: string | null;
  title?: string | null;
  agent_id?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  last_message_content?: string | null;
  unread_count?: number;
  embed?: {
    origin?: string | null;
    context?: string | null;
    headline?: string | null;
  } | null;
};

export type NameFallback = {
  untitled: string;
  fresh: string;
};

/** Stable hue so two agents with the same name are not the same gray circle. */
export function avatarHue(seed: string): number {
  const s = seed.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function avatarBackground(seed: string): string {
  if (!seed.trim()) return "";
  const hue = avatarHue(seed);
  return `linear-gradient(135deg, hsl(${hue} 38% 36%), hsl(${hue} 42% 22%))`;
}

/** One letter from the name. Color, not an id fragment, separates people who share it. */
export function avatarGlyph(displayName: string): string {
  const base = displayName.trim().split(" · ")[0] || "?";
  return (Array.from(base)[0] || "?").toUpperCase();
}

export function directShortId(agentId?: string | null): string {
  const id = (agentId || "").replace(/^acn:/i, "").trim();
  if (!id) return "";
  return id.length > 8 ? id.slice(0, 8) : id;
}

function agentKey(agentId?: string | null): string {
  return (agentId || "").replace(/^acn:/i, "").trim().toLowerCase();
}

function isGroup(chat: { type?: string | null }): boolean {
  return chat.type === "group" || chat.type === "GROUP";
}

/** One name for the inbox row and the conversation opened from that row. Title wins over a host headline. */
export function conversationDisplayName(chat: InboxChat, fallback: NameFallback): string {
  const title = (chat.title || "").trim();
  if (title) return title;
  const headline = (chat.embed?.headline || "").trim();
  if (headline) return headline;
  return chat.last_message_at || chat.created_at ? fallback.untitled : fallback.fresh;
}

/** One history row is one conversation, so its own headline stays visible. */
export function historyConversationName(chat: InboxChat, fallback: NameFallback): string {
  const headline = (chat.embed?.headline || "").trim();
  if (headline) return headline;
  return conversationDisplayName(chat, fallback);
}

export function withDistinctNames<T extends InboxChat>(
  rows: T[],
  fallback: NameFallback,
  hintFor: (row: T) => string,
): Array<T & { displayName: string }> {
  const bases = rows.map((row) => conversationDisplayName(row, fallback));
  const counts = new Map<string, number>();
  for (const name of bases) counts.set(name, (counts.get(name) ?? 0) + 1);
  return rows.map((row, index) => {
    const base = bases[index] ?? "";
    const hint = hintFor(row).trim();
    const displayName = (counts.get(base) ?? 0) > 1 && hint ? `${base} · ${hint}` : base;
    return { ...row, displayName };
  });
}

/** List search includes the preview line, not only the title. */
export function chatMatchesSearch(chat: InboxChat, query: string, fallback: NameFallback): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    conversationDisplayName(chat, fallback),
    chat.agent_id ?? "",
    chat.embed?.context ?? "",
    chat.embed?.headline ?? "",
    chat.last_message_content ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

/** History rows name the channel, not the host domain. */
export function hostChannelLabel(origin?: string | null): string {
  return (origin || "").trim() ? "Studio" : "";
}

export function maskReadChats<T extends { chat_id: string; unread_count?: number }>(
  list: T[],
  readIds: ReadonlySet<string>,
): T[] {
  return list.map((chat) =>
    readIds.has(chat.chat_id) && (chat.unread_count ?? 0) > 0
      ? { ...chat, unread_count: 0 }
      : chat,
  );
}

export type ReadHold = { ticket: number; until: number };

export function beginReadHold(holds: Map<string, ReadHold>, ids: string[], ticket: number) {
  for (const id of ids) holds.set(id, { ticket, until: Number.POSITIVE_INFINITY });
}

export function finishReadHold(
  holds: Map<string, ReadHold>,
  ids: string[],
  ticket: number,
  at: number,
) {
  for (const id of ids) {
    const current = holds.get(id);
    if (current && current.ticket === ticket) holds.set(id, { ticket, until: at });
  }
}

export function cancelReadHold(holds: Map<string, ReadHold>, ids: string[], ticket: number) {
  for (const id of ids) {
    const current = holds.get(id);
    if (current && current.ticket === ticket) holds.delete(id);
  }
}

/**
 * A list fetched before the read finished still shows the old badge.
 * A list that started afterwards is the server's current count, including new mail.
 */
export function applyReadHolds<T extends { chat_id: string; unread_count?: number }>(
  list: T[],
  holds: Map<string, ReadHold>,
  snapshotStartedAt: number,
): T[] {
  const next = list.map((chat) => {
    const hold = holds.get(chat.chat_id);
    if (!hold || snapshotStartedAt >= hold.until) return chat;
    return (chat.unread_count ?? 0) > 0 ? { ...chat, unread_count: 0 } : chat;
  });
  for (const chat of list) {
    const hold = holds.get(chat.chat_id);
    if (hold && snapshotStartedAt >= hold.until) holds.delete(chat.chat_id);
  }
  return next;
}

export type ListTimeLabels = { yesterday: string; weekdays: readonly string[] };

/** Chat-list time, the way messaging apps write it: 13:05, Yesterday, a weekday, 10/5, then 2025/10/5. */
export function formatListTime(
  iso: string | null | undefined,
  labels: ListTimeLabels,
  now: Date = new Date(),
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (dayDiff <= 0) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  if (dayDiff === 1) return labels.yesterday;
  if (dayDiff < 7) return labels.weekdays[date.getDay()] ?? "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() !== now.getFullYear()) return `${date.getFullYear()}/${month}/${day}`;
  return `${month}/${day}`;
}
