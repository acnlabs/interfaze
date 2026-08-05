import type { ChatMessage, ChatParticipant, ChatSummary, ThreadSummary } from "./types";

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
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      code = typeof detail.code === "string" ? detail.code : null;
      message = typeof detail.message === "string" ? detail.message : message;
    } else if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      // FastAPI / Pydantic validation errors
      const first = detail[0];
      if (first && typeof first === "object") {
        const msg = (first as { msg?: unknown }).msg;
        if (typeof msg === "string" && msg.trim()) message = msg.trim();
      } else if (typeof first === "string" && first.trim()) {
        message = first.trim();
      }
      code = "invalid_request";
    } else if (typeof body?.message === "string" && body.message.trim()) {
      message = body.message.trim();
    }
  } catch {
    /* ignore */
  }
  return new ChatGatewayError(res.status, code, message);
}

export type ChatAgentSearchHit = {
  agent_id: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  acl_reason?: string | null;
};

/** Owned agent wallet from GET /api/chat/my-agents/{id}/wallet. */
export type MyAgentWallet = {
  agent_id: string;
  wallet_id: string;
  balance: number;
  ap_points: number;
  owner_id?: string | null;
  status?: string | null;
  /** Human (owner) Credits available for top-up. */
  owner_balance: number;
};

export type MyAgentWalletTx = {
  transaction_id: string;
  wallet_id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  status: string;
  description?: string | null;
  created_at?: string | null;
};

export type MyAgentWalletTxList = {
  transactions: MyAgentWalletTx[];
  total: number;
  page: number;
  page_size: number;
};

export type SpendAutonomy = "disabled" | "limited" | "unlimited";

export type MyAgentSpendPolicy = {
  agent_id: string;
  owner_id?: string | null;
  autonomy: SpendAutonomy | string;
  stored_autonomy: SpendAutonomy | string;
  per_tx_limit: number | null;
  window_limit: number | null;
  window_hours: number;
  reserve_floor: number;
  window_spent: number;
  window_remaining: number | null;
  balance: number;
};

export type MyAgentSpendPolicyUpdate = {
  autonomy?: SpendAutonomy;
  per_tx_limit?: number | null;
  window_limit?: number | null;
  window_hours?: number;
  reserve_floor?: number;
};

/** Owned ACN agent row from GET /api/chat/my-agents (management + directory mine). */
export type MyAgentSummary = {
  agent_id: string;
  name?: string | null;
  description?: string | null;
  tags?: string[];
  status?: string | null;
  claim_status?: string | null;
  delivery?: "direct" | "relay" | "none" | string | null;
  last_heartbeat?: string | null;
  endpoint_masked?: string | null;
  /** False when receive mode is pull / not set — URL reachability does not apply. */
  inbound_applicable?: boolean | null;
  inbound_reachable?: boolean | null;
  policy_mode?: string | null;
  chat_open?: boolean | null;
  owner?: string | null;
  /** Present after a successful delivery PATCH when ACN returns follow-up copy. */
  next_step_hint?: string | null;
};

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
  sendMessage: (
    chatId: string,
    content: string,
    mentions?: string[],
    threadId?: string | null,
  ) => Promise<ChatMessage>;
  listThreads: (chatId: string) => Promise<ThreadSummary[]>;
  createThread: (
    chatId: string,
    body: { title?: string; objective?: string },
  ) => Promise<ThreadSummary>;
  /** D9-filtered discoverable agents (excludes caller's own). */
  searchAgents: (q?: string, limit?: number) => Promise<ChatAgentSearchHit[]>;
  /** Owner's ACN agents (same region / alive as directory mine). */
  listMyAgents: (limit?: number) => Promise<MyAgentSummary[]>;
  getMyAgent: (agentId: string) => Promise<MyAgentSummary>;
  /** Rotate ACN API key; plaintext returned once — do not log. */
  rotateMyAgentKey: (agentId: string) => Promise<{
    success: boolean;
    agent_id: string;
    api_key: string;
    message?: string;
  }>;
  /** Permanently delete an owned ACN identity (registry unregister). */
  deleteMyAgent: (agentId: string) => Promise<{
    success: boolean;
    agent_id: string;
    status: string;
  }>;
  /** Owner-side profile patch; returns refreshed detail. */
  updateMyAgentProfile: (
    agentId: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) => Promise<MyAgentSummary>;
  /** Switch receive mode: push-to-URL (direct) or agent-pull (relay). */
  updateMyAgentDelivery: (
    agentId: string,
    patch: { delivery: "direct" | "relay"; endpoint?: string },
  ) => Promise<MyAgentSummary>;
  /** Set reception policy mode (allowlist members edited elsewhere). */
  updateMyAgentPolicy: (
    agentId: string,
    patch: { mode: "open" | "allowlist" | "closed" },
  ) => Promise<MyAgentSummary>;
  /** Owned agent wallet + owner human balance (Credits). */
  getMyAgentWallet: (agentId: string) => Promise<MyAgentWallet>;
  listMyAgentWalletTransactions: (
    agentId: string,
    page?: number,
    pageSize?: number,
  ) => Promise<MyAgentWalletTxList>;
  topupMyAgentWallet: (
    agentId: string,
    amount: number,
    description?: string,
  ) => Promise<MyAgentWallet>;
  withdrawMyAgentWallet: (
    agentId: string,
    amount: number,
    description?: string,
  ) => Promise<MyAgentWallet>;
  getMyAgentSpendPolicy: (agentId: string) => Promise<MyAgentSpendPolicy>;
  updateMyAgentSpendPolicy: (
    agentId: string,
    patch: MyAgentSpendPolicyUpdate,
  ) => Promise<MyAgentSpendPolicy>;
  addParticipant: (chatId: string, agentId: string) => Promise<ChatParticipant>;
  removeParticipant: (chatId: string, participantId: string) => Promise<void>;
  updateChat: (chatId: string, patch: { title?: string; description?: string }) => Promise<ChatSummary>;
  deleteChat: (chatId: string) => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
};

export function createGatewayClient(
  gatewayBaseUrl: string,
  getAccessToken: () => Promise<string | null>,
): GatewayClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    if (!token) {
      throw new ChatGatewayError(401, "not_authenticated", "Not authenticated");
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    };

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
    searchAgents: async (q = "", limit = 20) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(limit));
      const data = await request<{ agents?: ChatAgentSearchHit[] }>(
        `/api/chat/agents/search?${params.toString()}`,
      );
      return data.agents ?? [];
    },
    listMyAgents: async (limit = 50) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      const data = await request<{ agents?: MyAgentSummary[] }>(
        `/api/chat/my-agents?${params.toString()}`,
      );
      return data.agents ?? [];
    },
    getMyAgent: (agentId) =>
      request<MyAgentSummary>(`/api/chat/my-agents/${encodeURIComponent(agentId)}`),
    rotateMyAgentKey: (agentId) =>
      request<{
        success: boolean;
        agent_id: string;
        api_key: string;
        message?: string;
      }>(`/api/chat/my-agents/${encodeURIComponent(agentId)}/rotate-key`, {
        method: "POST",
      }),
    deleteMyAgent: (agentId) =>
      request<{
        success: boolean;
        agent_id: string;
        status: string;
      }>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}?confirm=true`,
        { method: "DELETE" },
      ),
    updateMyAgentProfile: (agentId, patch) =>
      request<MyAgentSummary>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/profile`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      ),
    updateMyAgentDelivery: (agentId, patch) =>
      request<MyAgentSummary>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/delivery`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      ),
    updateMyAgentPolicy: (agentId, patch) =>
      request<MyAgentSummary>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/policy`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      ),
    getMyAgentWallet: (agentId) =>
      request<MyAgentWallet>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet`,
      ),
    listMyAgentWalletTransactions: (agentId, page = 1, pageSize = 20) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      return request<MyAgentWalletTxList>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/transactions?${params}`,
      );
    },
    topupMyAgentWallet: (agentId, amount, description) =>
      request<MyAgentWallet>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/topup`,
        {
          method: "POST",
          body: JSON.stringify({
            amount,
            ...(description ? { description } : {}),
          }),
        },
      ),
    withdrawMyAgentWallet: (agentId, amount, description) =>
      request<MyAgentWallet>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/withdraw`,
        {
          method: "POST",
          body: JSON.stringify({
            amount,
            ...(description ? { description } : {}),
          }),
        },
      ),
    getMyAgentSpendPolicy: (agentId) =>
      request<MyAgentSpendPolicy>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/spend-policy`,
      ),
    updateMyAgentSpendPolicy: (agentId, patch) =>
      request<MyAgentSpendPolicy>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/spend-policy`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      ),
    listMessages: (chatId) =>
      request<ChatMessage[]>(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`),
    listParticipants: (chatId) =>
      request<ChatParticipant[]>(`/api/chats/${encodeURIComponent(chatId)}/participants`),
    sendMessage: (chatId, content, mentions, threadId) =>
      request<ChatMessage>(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          mentions: mentions ?? null,
          thread_id: threadId || null,
        }),
      }),
    listThreads: async (chatId) => {
      const data = await request<{ data?: ThreadSummary[]; total?: number }>(
        `/api/chats/${encodeURIComponent(chatId)}/threads?limit=50&order=desc`,
      );
      return data.data ?? [];
    },
    createThread: (chatId, body) =>
      request<ThreadSummary>(`/api/chats/${encodeURIComponent(chatId)}/threads`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    addParticipant: (chatId, agentId) =>
      request<ChatParticipant>(`/api/chats/${encodeURIComponent(chatId)}/participants`, {
        method: "POST",
        body: JSON.stringify({ participant_type: "agent", participant_id: agentId }),
      }),
    removeParticipant: (chatId, participantId) =>
      request<void>(
        `/api/chats/${encodeURIComponent(chatId)}/participants/${encodeURIComponent(participantId)}`,
        { method: "DELETE" },
      ),
    updateChat: (chatId, patch) =>
      request<ChatSummary>(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    deleteChat: (chatId) =>
      request<void>(`/api/chats/${encodeURIComponent(chatId)}`, { method: "DELETE" }),
    markChatAsRead: (chatId) =>
      request<void>(`/api/chats/${encodeURIComponent(chatId)}/read`, { method: "PUT" }),
  };
}
