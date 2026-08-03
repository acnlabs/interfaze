import type { ChatMessage, ChatParticipant, ChatSummary } from "./types";

export class ChatGatewayError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "ChatGatewayError";
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function parseError(res: Response): Promise<ChatGatewayError> {
  let code: string | null = null;
  let message = res.statusText || `HTTP ${res.status}`;
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (detail && typeof detail === "object") {
      code = typeof detail.code === "string" ? detail.code : null;
      message = typeof detail.message === "string" ? detail.message : message;
    } else if (typeof detail === "string") {
      message = detail;
    }
  } catch {
    /* ignore */
  }
  return new ChatGatewayError(res.status, code, message);
}

export type GatewayClient = {
  health: () => Promise<{ status: string; gateway?: string; ok: boolean; error?: string }>;
  listChats: () => Promise<ChatSummary[]>;
  createDirect: (agentId: string) => Promise<ChatSummary>;
  /** Alias used by Shell — same as createDirect (server upserts). */
  createOrGetDirectChat: (agentId: string) => Promise<ChatSummary>;
  createGroup: (title: string, agentIds: string[]) => Promise<ChatSummary>;
  /** Alias used by Shell. */
  createGroupChat: (title: string, agentIds: string[]) => Promise<ChatSummary>;
  listMessages: (chatId: string) => Promise<ChatMessage[]>;
  listParticipants: (chatId: string) => Promise<ChatParticipant[]>;
  sendMessage: (chatId: string, content: string, mentions?: string[]) => Promise<ChatMessage>;
};

export function createGatewayClient(
  gatewayBaseUrl: string,
  getAccessToken: () => Promise<string | null>,
): GatewayClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(joinUrl(gatewayBaseUrl, path), { ...init, headers });
    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const createDirect = (agentId: string) =>
    request<ChatSummary>("/api/chats/direct", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId }),
    });

  const createGroup = (title: string, agentIds: string[]) =>
    request<ChatSummary>("/api/chats/group", {
      method: "POST",
      body: JSON.stringify({
        title,
        participant_ids: agentIds.map((id) => ({ type: "agent", id })),
      }),
    });

  return {
    health: async () => {
      const h = await request<{ status: string; gateway?: string }>("/api/chat/health");
      return { ...h, ok: h.status === "ok" };
    },
    listChats: async () => {
      const data = await request<{ chats: ChatSummary[] }>("/api/chats?page=1&page_size=50");
      return data.chats ?? [];
    },
    createDirect,
    createOrGetDirectChat: createDirect,
    createGroup,
    createGroupChat: createGroup,
    listMessages: (chatId) =>
      request<ChatMessage[]>(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`),
    listParticipants: (chatId) =>
      request<ChatParticipant[]>(`/api/chats/${encodeURIComponent(chatId)}/participants`),
    sendMessage: (chatId, content, mentions) =>
      request<ChatMessage>(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, mentions: mentions ?? null }),
      }),
  };
}
