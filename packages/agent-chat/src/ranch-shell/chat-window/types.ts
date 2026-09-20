export type ChatWindowKind = "talk";

export type TalkWindowPayload = {
  agentId: string;
  hostPath: string;
  hostToken: string;
  hostExpiresAt?: number;
  shareToken?: string;
  projectId?: string;
  name?: string;
};

export type ChatWindow = {
  chatId: string;
  kind: ChatWindowKind;
  title?: string;
  payload: TalkWindowPayload;
};

export type TalkOpenResult = {
  id: string;
  shareToken: string;
  hostPath: string;
  hostToken?: string;
  hostExpiresIn?: number;
  name?: string;
  agentId?: string;
  code?: string;
  error?: string;
};

export function talkHostSrc(args: {
  studioBaseUrl: string;
  hostPath: string;
  chatId: string;
  hostToken: string;
}): string {
  const origin = args.studioBaseUrl.replace(/\/+$/, "");
  const path = args.hostPath.startsWith("/") ? args.hostPath : `/${args.hostPath}`;
  const url = new URL(path, `${origin}/`);
  url.searchParams.set("chatId", args.chatId);
  const hash = args.hostToken ? `#th=${encodeURIComponent(args.hostToken)}` : "";
  return `${url.origin}${url.pathname}${url.search}${hash}`;
}

export function studioOriginOf(studioBaseUrl: string): string {
  try {
    return new URL(studioBaseUrl).origin;
  } catch {
    return "";
  }
}

/** Re-mint this far before hostToken expiry. */
export const TALK_REFRESH_LEAD_MS = 90_000;

export function talkTokenFresh(
  window: ChatWindow | null | undefined,
  now = Date.now(),
): boolean {
  if (!window || window.kind !== "talk" || !window.payload.hostToken) return false;
  const exp = window.payload.hostExpiresAt;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return true;
  return exp - now > TALK_REFRESH_LEAD_MS;
}

export function talkWindowFromOpen(args: {
  chatId: string;
  agentId: string;
  data: TalkOpenResult;
  title: string;
  now?: number;
}): ChatWindow | null {
  if (!args.data.hostPath || !args.data.hostToken) return null;
  const expiresIn = args.data.hostExpiresIn;
  return {
    chatId: args.chatId,
    kind: "talk",
    title: args.data.name || args.title,
    payload: {
      agentId: args.data.agentId || args.agentId,
      hostPath: args.data.hostPath,
      hostToken: args.data.hostToken,
      hostExpiresAt:
        typeof expiresIn === "number"
          ? (args.now ?? Date.now()) + expiresIn * 1000
          : undefined,
      shareToken: args.data.shareToken,
      projectId: args.data.id,
      name: args.data.name,
    },
  };
}
