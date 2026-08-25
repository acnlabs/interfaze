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

/** Human Credits wallet from GET /api/chat/wallet. */
export type HumanWallet = {
  wallet_id: string;
  balance: number;
  status?: string | null;
  owner_id?: string | null;
};

/** Catalog tier from GET /api/chat/plan-usage. */
export type PlanCatalogEntry = {
  code: string;
  label: string;
  label_zh?: string;
  price_credits: number | null;
  purchasable: boolean;
  dialog_allowance_credits: number | null;
  /** List price in local fiat (USD global / CNY cn). */
  fiat_amount?: number | null;
  fiat_currency?: "USD" | "CNY" | string | null;
  features?: string[];
};

/** Plan entitlement + dialog usage from GET /api/chat/plan-usage. */
export type PlanUsage = {
  plan: {
    code: string;
    label: string;
    label_zh?: string;
    features?: string[];
    status?: string;
    /** ISO end of paid access; null on Free / expired. */
    paid_until?: string | null;
    /** Rolling paid period length in days (renew stacks). */
    period_days?: number;
    /** True when current paid tier can be renewed via purchase. */
    renewable?: boolean;
  };
  /** Adjust Plan cards; Free + purchasable paid tiers. */
  catalog?: PlanCatalogEntry[];
  /** Backend plan market: global (USD) or cn (CNY). */
  market?: "global" | "cn" | string;
  period: {
    start: string;
    end: string;
    kind: string;
  };
  allowance: {
    dialog_credits: number | null;
    dialog_credits_used: number;
    dialog_credits_remaining: number | null;
    /** False until dialog settle consumes included pack before Wallet. */
    honored?: boolean;
  };
  usage: {
    dialog_credits: number;
    by_agent: Array<{ agent_id: string; credits: number }>;
  };
  /** User self-serve monthly on-demand spend cap (works on Free). */
  on_demand?: {
    mode: "unlimited" | "fixed";
    limit_credits: number | null;
    spent_credits: number;
    remaining_credits: number | null;
  };
  chat_billing_enabled: boolean;
};

/** Per-chat collaboration oil tank (P13). */
export type ChatCollabBudget = {
  cap_credits: number;
  remaining_credits: number;
  can_auto: boolean;
  task_id?: string | null;
  account_cap_credits?: number;
  added?: number;
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

export type SpendRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type MyAgentSpendRequest = {
  request_id: string;
  agent_id: string;
  amount: number;
  description: string;
  status: SpendRequestStatus | string;
  created_at: string | null;
  expires_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  reject_reason: string | null;
};

export type MyAgentSpendRequestList = {
  requests: MyAgentSpendRequest[];
};

export type MyAgentSpendApproveResponse = {
  request: MyAgentSpendRequest;
  wallet: MyAgentWallet;
};

export type MyAgentAllowlistEntry = {
  target_id: string;
  created_at: string;
  reason?: string | null;
};

export type MyAgentAllowlist = {
  owner_id: string;
  entries: MyAgentAllowlistEntry[];
  total: number;
};

export type MyAgentAllowlistAction = {
  owner_id: string;
  target_id: string;
  allowlisted: boolean;
  changed: boolean;
};

export type MyAgentHumanAccess = {
  agent_id: string;
  invitees: string[];
  visibility: "public" | "invite_only" | string;
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
  /** L2 listing from ACN (owner detail); null when unlisted. */
  token_pricing?: {
    input_price_per_million: number;
    output_price_per_million: number;
    currency?: string;
    model_id?: string | null;
    /** Owner markup vs Host Catalog; UI derives listing = catalog × (1+m/100). */
    markup_percent?: number | null;
  } | null;
  /**
   * Best-effort declared model (listing / metadata). Not cryptographic proof.
   */
  preferred_model_id?: string | null;
  /**
   * Self-reported via ACN heartbeat ``metadata.preferred_model``.
   * Prefer this for Pricing prefill when unlisted; not verified.
   */
  runtime_model_id?: string | null;
  /**
   * Agent-level path stays ``byo``. Chat picks a model; official is Settings (I2).
   */
  inference_path?: "byo" | "official" | string | null;
  /** Host holds its own inference key. Official provider is hidden until true. */
  host_inference_ready?: boolean | null;
  /** Owner-authorized official model ids (Host table). */
  official_models?: string[] | null;
  /** Present after a successful delivery PATCH when ACN returns follow-up copy. */
  next_step_hint?: string | null;
};

export type ModelCatalogItem = {
  model_id: string;
  display_name?: string | null;
  input_price_per_million: number;
  output_price_per_million: number;
  /** Official Catalog = Host sync × 1.15. Absent on older Hosts. */
  published_input_price_per_million?: number | null;
  published_output_price_per_million?: number | null;
  currency?: string;
  source?: string | null;
};

export const OFFICIAL_PUBLISH_FACTOR = 1.15;

export function officialCatalogRates(row: {
  input_price_per_million: number;
  output_price_per_million: number;
  published_input_price_per_million?: number | null;
  published_output_price_per_million?: number | null;
}): { input: number; output: number } | null {
  const syncIn = Number(row.input_price_per_million);
  const syncOut = Number(row.output_price_per_million);
  if (!Number.isFinite(syncIn) || !Number.isFinite(syncOut)) return null;
  const publishedIn = Number(row.published_input_price_per_million);
  const publishedOut = Number(row.published_output_price_per_million);
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    input: Number.isFinite(publishedIn)
      ? publishedIn
      : round(syncIn * OFFICIAL_PUBLISH_FACTOR),
    output: Number.isFinite(publishedOut)
      ? publishedOut
      : round(syncOut * OFFICIAL_PUBLISH_FACTOR),
  };
}

export type ModelCatalogList = {
  items: ModelCatalogItem[];
  total: number;
  limit: number;
  offset: number;
};

export type GatewayClient = {
  health: () => Promise<{ status: string; gateway?: string; ok: boolean; error?: string }>;
  listChats: () => Promise<ChatSummary[]>;
  createDirect: (
    agentId: string,
    opts?: { context?: string | null },
  ) => Promise<ChatSummary>;
  /** Alias used by Shell — omit context to upsert the global 1:1. */
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
    opts?: { requested_model?: string | null; requested_provider?: string | null },
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
  /** Listed vs runtime model + supported options for composer (M1/M2). */
  getAgentModelStatus: (agentId: string) => Promise<{
    agent_id: string;
    listed_model_id?: string | null;
    runtime_model_id?: string | null;
    inference_path?: "byo" | "official" | string | null;
    host_inference_ready?: boolean;
    official_models?: string[];
    providers?: Array<{
      id: string;
      kind: "byo" | "official" | string;
      brand?: string;
    }>;
    mismatched: boolean;
    markup_percent?: number | null;
    supported_models?: string[];
    self_reported_models?: string[];
    model_options?: Array<{
      model_id: string;
      is_listing?: boolean;
      is_runtime?: boolean;
      inference_path?: "byo" | "official" | string | null;
      input_price_per_million?: number;
      output_price_per_million?: number;
      pricing_source?: string;
      free?: boolean;
      priceable?: boolean;
    }>;
  }>;
  /** Replace Owner-authorized official models. Empty = all hops BYO. */
  updateMyAgentOfficialModels: (
    agentId: string,
    modelIds: string[],
  ) => Promise<{
    agent_id: string;
    model_ids: string[];
    host_inference_ready: boolean;
  }>;
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
  /** Owner-side L2 token pricing; omit modelId to keep prior on server. */
  updateMyAgentTokenPricing: (
    agentId: string,
    pricing: {
      input_price_per_million: number;
      output_price_per_million: number;
      model_id?: string;
      markup_percent?: number;
    },
  ) => Promise<MyAgentSummary>;
  /** Public Host Model Catalog (L1) row for a model id. */
  getModelCatalogItem: (modelId: string) => Promise<ModelCatalogItem>;
  /** Public Host Model Catalog list (OpenRouter + host_pack). */
  listModelCatalog: (opts?: {
    q?: string;
    source?: string;
    active_only?: boolean;
    limit?: number;
    offset?: number;
  }) => Promise<ModelCatalogList>;
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
  /** Signed-in human Credits wallet. */
  getHumanWallet: () => Promise<HumanWallet>;
  listHumanWalletTransactions: (
    page?: number,
    pageSize?: number,
  ) => Promise<MyAgentWalletTxList>;
  /** Plan entitlement + dialog usage (not Wallet balance). */
  getPlanUsage: () => Promise<PlanUsage>;
  putOnDemandLimit: (
    mode: "unlimited" | "fixed",
    limitCredits?: number | null,
  ) => Promise<PlanUsage>;
  /** Spend Wallet Credits to activate a purchasable catalog tier. */
  /** @deprecated Credits purchase disabled — use getPlanCheckout. */
  purchasePlan: (planCode: string, idempotencyKey?: string) => Promise<PlanUsage>;
  getPlanCheckout: (planCode: string) => Promise<{
    plan_code: string;
    checkout_url: string;
    fiat_amount: number | null;
    fiat_currency: string | null;
    period_days: number;
  }>;
  /** Account default collaboration tank size (preference; no lock). */
  getCollabCap: () => Promise<{ cap_credits: number }>;
  putCollabCap: (capCredits: number) => Promise<{ cap_credits: number }>;
  getChatCollabBudget: (chatId: string) => Promise<ChatCollabBudget>;
  addChatCollabBudget: (chatId: string, amount: number) => Promise<ChatCollabBudget>;
  ensureChatCollabDefault: (chatId: string) => Promise<ChatCollabBudget>;
  releaseChatCollabBudget: (chatId: string) => Promise<ChatCollabBudget & { refunded?: number }>;
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
  listMyAgentSpendRequests: (
    agentId: string,
    status?: SpendRequestStatus,
    limit?: number,
  ) => Promise<MyAgentSpendRequestList>;
  approveMyAgentSpendRequest: (
    agentId: string,
    requestId: string,
  ) => Promise<MyAgentSpendApproveResponse>;
  rejectMyAgentSpendRequest: (
    agentId: string,
    requestId: string,
    reason?: string,
  ) => Promise<MyAgentSpendRequest>;
  listMyAgentAllowlist: (agentId: string) => Promise<MyAgentAllowlist>;
  addMyAgentAllowlistMember: (
    agentId: string,
    targetId: string,
    reason?: string,
  ) => Promise<MyAgentAllowlistAction>;
  removeMyAgentAllowlistMember: (
    agentId: string,
    targetId: string,
  ) => Promise<MyAgentAllowlistAction>;
  getMyAgentHumanAccess: (agentId: string) => Promise<MyAgentHumanAccess>;
  replaceMyAgentHumanAccess: (
    agentId: string,
    patch: {
      invitees: string[];
      visibility?: "public" | "invite_only";
    },
  ) => Promise<MyAgentHumanAccess>;
  /** Create (or return pending) gift invite; share_url is relative. */
  createJoinInvite: () => Promise<{
    code: string;
    expires_at: string;
    share_url: string;
  }>;
  createMyAgentTransferInvite: (agentId: string) => Promise<{
    invite_token: string;
    expires_at: string;
    share_url: string;
  }>;
  /** Cancel pending gift invite for an owned agent. */
  cancelMyAgentTransferInvite: (agentId: string) => Promise<{ success: boolean }>;
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

  const createDirect = (agentId: string, opts?: { context?: string | null }) =>
    request<ChatSummary>("/api/chats/direct", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        ...(opts?.context ? { context: opts.context } : {}),
      }),
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
      const data = await request<{ chats: ChatSummary[] }>("/api/chats?page=1&page_size=200");
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
    getAgentModelStatus: (agentId) =>
      request<{
        agent_id: string;
        listed_model_id?: string | null;
        runtime_model_id?: string | null;
        inference_path?: "byo" | "official" | string | null;
        host_inference_ready?: boolean;
        official_models?: string[];
        providers?: Array<{
          id: string;
          kind: "byo" | "official" | string;
          brand?: string;
        }>;
        mismatched: boolean;
        markup_percent?: number | null;
        supported_models?: string[];
        self_reported_models?: string[];
        model_options?: Array<{
          model_id: string;
          is_listing?: boolean;
          is_runtime?: boolean;
          inference_path?: "byo" | "official" | string | null;
          input_price_per_million?: number;
          output_price_per_million?: number;
          pricing_source?: string;
          free?: boolean;
          priceable?: boolean;
        }>;
      }>(`/api/chat/agents/${encodeURIComponent(agentId)}/model-status`),
    updateMyAgentOfficialModels: (agentId, modelIds) =>
      request<{
        agent_id: string;
        model_ids: string[];
        host_inference_ready: boolean;
      }>(`/api/chat/my-agents/${encodeURIComponent(agentId)}/official-models`, {
        method: "PUT",
        body: JSON.stringify({ model_ids: modelIds }),
      }),
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
    updateMyAgentTokenPricing: (agentId, pricing) =>
      request<MyAgentSummary>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/token-pricing`,
        {
          method: "PUT",
          body: JSON.stringify(pricing),
        },
      ),
    getModelCatalogItem: (modelId) => {
      // Keep `/` as path segments for FastAPI `{model_id:path}`.
      const path = modelId
        .split("/")
        .map((p) => encodeURIComponent(p))
        .join("/");
      return request<ModelCatalogItem>(`/api/model-catalog/${path}`);
    },
    listModelCatalog: (opts) => {
      const params = new URLSearchParams();
      if (opts?.q?.trim()) params.set("q", opts.q.trim());
      if (opts?.source?.trim()) params.set("source", opts.source.trim());
      if (opts?.active_only === false) params.set("active_only", "false");
      params.set("limit", String(opts?.limit ?? 100));
      params.set("offset", String(opts?.offset ?? 0));
      return request<ModelCatalogList>(`/api/model-catalog?${params.toString()}`);
    },
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
    getHumanWallet: () => request<HumanWallet>("/api/chat/wallet"),
    getPlanUsage: () => request<PlanUsage>("/api/chat/plan-usage"),
    putOnDemandLimit: (mode, limitCredits) =>
      request<PlanUsage>("/api/chat/plan-usage/on-demand-limit", {
        method: "PUT",
        body: JSON.stringify({
          mode,
          limit_credits: mode === "fixed" ? (limitCredits ?? 0) : undefined,
        }),
      }),
    purchasePlan: (planCode, idempotencyKey) =>
      request<PlanUsage>("/api/chat/plan-usage/purchase", {
        method: "POST",
        body: JSON.stringify({
          plan_code: planCode,
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        }),
      }),
    getPlanCheckout: (planCode) => {
      const params = new URLSearchParams();
      params.set("plan_code", planCode);
      return request<{
        plan_code: string;
        checkout_url: string;
        fiat_amount: number | null;
        fiat_currency: string | null;
        period_days: number;
      }>(`/api/chat/plan-usage/checkout?${params}`);
    },
    listHumanWalletTransactions: (page = 1, pageSize = 20) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      return request<MyAgentWalletTxList>(
        `/api/chat/wallet/transactions?${params}`,
      );
    },
    getCollabCap: () => request<{ cap_credits: number }>("/api/chat/collab-cap"),
    putCollabCap: (capCredits) =>
      request<{ cap_credits: number }>("/api/chat/collab-cap", {
        method: "PUT",
        body: JSON.stringify({ cap_credits: capCredits }),
      }),
    getChatCollabBudget: (chatId) =>
      request<ChatCollabBudget>(
        `/api/chat/chats/${encodeURIComponent(chatId)}/collab-budget`,
      ),
    addChatCollabBudget: (chatId, amount) =>
      request<ChatCollabBudget>(
        `/api/chat/chats/${encodeURIComponent(chatId)}/collab-budget`,
        {
          method: "POST",
          body: JSON.stringify({ amount }),
        },
      ),
    ensureChatCollabDefault: (chatId) =>
      request<ChatCollabBudget>(
        `/api/chat/chats/${encodeURIComponent(chatId)}/collab-budget/ensure-default`,
        { method: "POST", body: "{}" },
      ),
    releaseChatCollabBudget: (chatId) =>
      request<ChatCollabBudget & { refunded?: number }>(
        `/api/chat/chats/${encodeURIComponent(chatId)}/collab-budget/release`,
        { method: "POST", body: "{}" },
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
    listMyAgentSpendRequests: (agentId, status, limit = 50) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (status) params.set("status", status);
      return request<MyAgentSpendRequestList>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/spend-requests?${params}`,
      );
    },
    approveMyAgentSpendRequest: (agentId, requestId) =>
      request<MyAgentSpendApproveResponse>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/spend-requests/${encodeURIComponent(requestId)}/approve`,
        { method: "POST", body: "{}" },
      ),
    rejectMyAgentSpendRequest: (agentId, requestId, reason) =>
      request<MyAgentSpendRequest>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/wallet/spend-requests/${encodeURIComponent(requestId)}/reject`,
        {
          method: "POST",
          body: JSON.stringify(reason ? { reason } : {}),
        },
      ),
    listMyAgentAllowlist: (agentId) =>
      request<MyAgentAllowlist>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/allowlist`,
      ),
    addMyAgentAllowlistMember: (agentId, targetId, reason) =>
      request<MyAgentAllowlistAction>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/allowlist/${encodeURIComponent(targetId)}`,
        {
          method: "POST",
          body: JSON.stringify(reason ? { reason } : {}),
        },
      ),
    removeMyAgentAllowlistMember: (agentId, targetId) =>
      request<MyAgentAllowlistAction>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/allowlist/${encodeURIComponent(targetId)}`,
        { method: "DELETE" },
      ),
    getMyAgentHumanAccess: (agentId) =>
      request<MyAgentHumanAccess>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/human-access`,
      ),
    replaceMyAgentHumanAccess: (agentId, patch) =>
      request<MyAgentHumanAccess>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/human-access`,
        {
          method: "PUT",
          body: JSON.stringify(patch),
        },
      ),
    createJoinInvite: () =>
      request<{ code: string; expires_at: string; share_url: string }>(
        "/api/chat/join-invites",
        { method: "POST", body: "{}" },
      ),
    createMyAgentTransferInvite: (agentId) =>
      request<{
        invite_token: string;
        expires_at: string;
        share_url: string;
      }>(`/api/chat/my-agents/${encodeURIComponent(agentId)}/transfer-invite`, {
        method: "POST",
        body: "{}",
      }),
    cancelMyAgentTransferInvite: (agentId) =>
      request<{ success: boolean }>(
        `/api/chat/my-agents/${encodeURIComponent(agentId)}/transfer-invite`,
        { method: "DELETE" },
      ),
    listMessages: (chatId) =>
      request<ChatMessage[]>(`/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`),
    listParticipants: (chatId) =>
      request<ChatParticipant[]>(`/api/chats/${encodeURIComponent(chatId)}/participants`),
    sendMessage: (chatId, content, mentions, threadId, opts) =>
      request<ChatMessage>(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          mentions: mentions ?? null,
          thread_id: threadId || null,
          ...(opts?.requested_model
            ? { requested_model: opts.requested_model }
            : {}),
          ...(opts?.requested_provider
            ? { requested_provider: opts.requested_provider }
            : {}),
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
