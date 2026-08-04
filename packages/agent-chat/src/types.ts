export type AgentChatMode = "side" | "full";

export type AgentChatContext = {
  task_id?: string;
  board_id?: string;
  workspace_id?: string;
};

export type AgentChatVariant = "assistant" | "shell";

/** Host-provided directory row for shell picker (mine / recommended). */
export type AgentDirectoryItem = {
  agent_id: string;
  name?: string | null;
  description?: string | null;
  group: "mine" | "recommended";
};

export type AgentChatShellProps = {
  /** Layout: side panel (default) or fullscreen overlay. */
  mode?: AgentChatMode;
  /**
   * `assistant` — Host Concierge / ComicLaw-like: one default agent, no 1:1·Group chrome.
   * `shell` — full ACN chat shell (picker, group, gateway status). Default.
   */
  variant?: AgentChatVariant;
  /** Controlled open state. When omitted, shell manages its own open flag. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Return Host bearer token (Auth0 / WeChat JWT via BFF). */
  getAccessToken: () => Promise<string | null>;
  /** Chat Gateway base, e.g. https://api.example.com or CN BFF origin. */
  gatewayBaseUrl: string;
  /** Host default / recommended ACN agent ids (Concierge etc.). */
  defaultAgentIds?: string[];
  /**
   * Claimed + recommended agents for shell picker.
   * Host loads these (e.g. Labs analytics owner= + system agents).
   */
  directoryAgents?: AgentDirectoryItem[];
  /** Allow typing another agent id. Default true for shell; ignored in assistant. */
  allowAgentPicker?: boolean;
  /** Show 1:1 / Group controls. Default true for shell; forced false in assistant. */
  allowGroupChat?: boolean;
  /** Show Gateway / WS debug strip. Default true for shell; forced false in assistant. */
  showGatewayStatus?: boolean;
  context?: AgentChatContext;
  locale?: string;
  onClose?: () => void;
  title?: string;
  /** Hide the floating launcher button (Host provides its own entry). */
  hideLauncher?: boolean;
  /**
   * Accent for assistant variant (user bubble / send / launcher).
   * Default Labs green `#10B981` (not ComicLaw gold).
   */
  accentColor?: string;
  /** Optional footer disclaimer under the assistant input (Studio-like). */
  disclaimer?: string;
};

export type ChatSummary = {
  chat_id: string;
  type: string;
  title?: string | null;
  agent_id?: string | null;
  last_message_at?: string | null;
  last_message_content?: string | null;
  unread_count?: number;
  agent_status?: string | null;
};

/** Host-provided signed-in user for the shell sidebar footer (Auth0 / WeChat / etc.). */
export type RanchChatAccount = {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

/** Props for ranch-ported shell (list + conversation + new-chat picker). */
export type RanchChatShellProps = {
  getAccessToken: () => Promise<string | null>;
  gatewayBaseUrl: string;
  directoryAgents?: AgentDirectoryItem[];
  title?: string;
  /** side panel (default) or fullscreen */
  mode?: AgentChatMode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  allowGroupChat?: boolean;
  /** Optional account strip at bottom of chat list (host owns IdP). */
  account?: RanchChatAccount | null;
  onLogout?: () => void;
  /**
   * Link for empty-state / owner setup ("how to connect an agent").
   * Host should point at a short plain-language guide.
   */
  connectGuideUrl?: string;
  /**
   * UI locale (BCP-47). Supported: `en` (default), `zh`.
   * Other values fall back to English.
   * When omitted, shell uses stored preference → browser language → `en`.
   */
  locale?: string;
  /** Called when the user switches language in the shell. */
  onLocaleChange?: (locale: "en" | "zh") => void;
};

/** Outbound delivery on user messages (Chat Gateway → ACN). */
export type MessageDelivery = "pending" | "delivered" | "queued" | "failed";

export type ChatMessage = {
  message_id: string;
  chat_id: string;
  sender_type: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  /** Parsed from API ``metadata``; used for delivery icons under user bubbles. */
  metadata?: {
    delivery?: MessageDelivery | string;
    delivery_mode?: string;
    delivery_agent_id?: string;
    [key: string]: unknown;
  } | null;
};

export type ChatParticipant = {
  participant_type: string;
  participant_id: string;
  role: string;
  is_active: boolean;
  name?: string | null;
};

/** Window / document event to open the shell from Host UI. */
export const CHAT_OPEN_EVENT = "acnlabs:agent-chat:open";

export type ChatOpenEventDetail = {
  agentId?: string;
  mode?: AgentChatMode;
  context?: AgentChatContext;
};
