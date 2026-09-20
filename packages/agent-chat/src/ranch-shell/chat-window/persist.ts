import type { ChatWindow } from "./types";

const STORAGE_KEY = "interfaze:chatWindow:v1";

/** Slot chrome only — never persist hostToken. */
export type PersistedChatWindow = {
  open: boolean;
  kind?: "talk";
  agentId?: string;
  hostPath?: string;
  shareToken?: string;
  projectId?: string;
  name?: string;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readPersistedChatWindows(): Record<string, PersistedChatWindow> {
  if (!canUseSessionStorage()) return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: Record<string, PersistedChatWindow> = {};
    for (const [chatId, row] of Object.entries(parsed as Record<string, unknown>)) {
      if (!chatId || !row || typeof row !== "object" || Array.isArray(row)) continue;
      const rec = row as Record<string, unknown>;
      next[chatId] = {
        open: rec.open === true,
        kind: rec.kind === "talk" ? "talk" : undefined,
        agentId: typeof rec.agentId === "string" ? rec.agentId : undefined,
        hostPath: typeof rec.hostPath === "string" ? rec.hostPath : undefined,
        shareToken: typeof rec.shareToken === "string" ? rec.shareToken : undefined,
        projectId: typeof rec.projectId === "string" ? rec.projectId : undefined,
        name: typeof rec.name === "string" ? rec.name : undefined,
      };
    }
    return next;
  } catch {
    return {};
  }
}

export function writePersistedChatWindows(map: Record<string, PersistedChatWindow>): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function readPersistedPaneOpen(): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  for (const [chatId, row] of Object.entries(readPersistedChatWindows())) {
    if (row.open) open[chatId] = true;
  }
  return open;
}

export function mergePersistedChatWindows(
  prev: Record<string, PersistedChatWindow>,
  paneOpenByChat: Record<string, boolean>,
  chatWindows: Record<string, ChatWindow>,
): Record<string, PersistedChatWindow> {
  const next: Record<string, PersistedChatWindow> = { ...prev };
  for (const [chatId, open] of Object.entries(paneOpenByChat)) {
    next[chatId] = { ...(next[chatId] ?? { open }), open };
  }
  for (const [chatId, win] of Object.entries(chatWindows)) {
    if (win.kind !== "talk") continue;
    next[chatId] = {
      open: Boolean(paneOpenByChat[chatId]),
      kind: "talk",
      agentId: win.payload.agentId,
      hostPath: win.payload.hostPath,
      shareToken: win.payload.shareToken,
      projectId: win.payload.projectId,
      name: win.payload.name,
    };
  }
  return next;
}
