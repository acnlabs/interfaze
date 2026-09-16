export type ChatWindowKind = "talk" | "body";

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
