export type ChatWindowKind = "talk" | "body" | "body-pick";

export type TalkWindowPayload = {
  agentId: string;
  hostPath: string;
  hostToken: string;
  hostExpiresAt?: number;
  bodyId?: string;
  shareToken?: string;
  projectId?: string;
  name?: string;
};

export type BodyPickItem = {
  id: string;
  name: string;
  origin?: string;
  live?: boolean;
};

export type ChatWindow =
  | {
      chatId: string;
      kind: "talk" | "body";
      title?: string;
      payload: TalkWindowPayload;
    }
  | {
      chatId: string;
      kind: "body-pick";
      title?: string;
      agentId: string;
      bodies: BodyPickItem[];
    };

export type TalkOpenResult = {
  id?: string;
  shareToken?: string;
  hostPath?: string;
  hostToken?: string;
  hostExpiresIn?: number;
  name?: string;
  agentId?: string;
  bodyId?: string;
  pick?: boolean;
  bodies?: BodyPickItem[];
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

export function bodyIdFromHostPath(hostPath: string): string {
  const match = hostPath.match(/\/b\/([^/]+)\/host\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}
