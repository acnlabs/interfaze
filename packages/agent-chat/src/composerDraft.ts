/** Unsent composer text, one key per chat. Empty deletes; spaces stay. */

export function composerDraftStorageKey(chatId: string): string {
  return `interfaze:composerDraft:${chatId}`;
}

/** null means remove the key. A string of spaces is still a draft. */
export function composerDraftToStore(text: string): string | null {
  return text === "" ? null : text;
}

export function composerDraftFromStore(raw: string | null): string {
  return raw ?? "";
}

/**
 * After a successful send, drop the snapshot that was sent.
 * Text typed since that snapshot stays.
 */
export function composerDraftAfterSend(sentDraft: string, current: string): string {
  return current === sentDraft ? "" : current;
}

/**
 * Empty composer walks back through your own messages.
 * `current` is null until the first step. Older stops on the earliest.
 * Newer from the latest returns null, which means the box is empty again.
 */
export function stepComposerRecall(
  count: number,
  current: number | null,
  direction: "older" | "newer",
): number | null {
  if (count <= 0) return null;
  if (direction === "older") {
    if (current == null) return count - 1;
    return current > 0 ? current - 1 : current;
  }
  if (current == null || current >= count - 1) return null;
  return current + 1;
}

/**
 * Inbox is one row per agent. Prefer the open chat's unsent text, otherwise
 * the latest sibling that still has some. `chatIds` is latest activity first.
 */
export function pickInboxDraft(args: {
  chatIds: string[];
  openChatId: string | null;
  openDraft: string;
  stored: (chatId: string) => string;
  visible: (raw: string) => string;
}): { chatId: string; text: string } | null {
  const line = (chatId: string): { chatId: string; text: string } | null => {
    const raw = chatId === args.openChatId ? args.openDraft : args.stored(chatId);
    const text = args.visible(raw);
    return text ? { chatId, text } : null;
  };
  if (args.openChatId && args.chatIds.includes(args.openChatId)) {
    const open = line(args.openChatId);
    if (open) return open;
  }
  for (const id of args.chatIds) {
    const hit = line(id);
    if (hit) return hit;
  }
  return null;
}

const UNSENT_PREFIXES = [
  "interfaze:composerDraft:",
  "interfaze:composerReply:",
  "interfaze:composerFiles:",
  "interfaze:stickyMention:",
];

/** Drafts, reply chips, staged files, and group @ chips. Model picks stay. */
export function clearComposerUnsent(store: {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}): void {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && UNSENT_PREFIXES.some((prefix) => key.startsWith(prefix))) doomed.push(key);
  }
  for (const key of doomed) store.removeItem(key);
}
