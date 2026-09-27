/** Chat mailbox refs: only ``mbx:{id}`` is renderable. Hotlinks never become img src. */

export const MAILBOX_PREFIX = "mbx:";

export function parseMessageAttachments(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function mailboxIdsFromAttachments(refs: string[]): string[] {
  const ids: string[] = [];
  for (const ref of refs) {
    const t = ref.trim();
    if (!t.startsWith(MAILBOX_PREFIX)) continue;
    const id = t.slice(MAILBOX_PREFIX.length).trim();
    if (!id || id.includes("/") || id.includes("..")) continue;
    ids.push(id);
  }
  return ids;
}

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,8})?$/i;
const HEX32_FILE = /^[0-9a-f]{32}(\.[a-z0-9]{1,8})?$/i;

/** Download links need a hunter-readable name. Mailbox ids stay off the bubble. */
export function isReadableAttachmentName(name: string, mailboxId: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (n === mailboxId || n === `${MAILBOX_PREFIX}${mailboxId}`) return false;
  const base = n.split(/[/\\]/).pop() || n;
  if (UUID_FILE.test(base) || HEX32_FILE.test(base)) return false;
  return true;
}

export function normalizeChatMessage<T extends { attachments?: unknown }>(
  row: T,
): T & { attachments: string[] } {
  return { ...row, attachments: parseMessageAttachments(row.attachments) };
}
