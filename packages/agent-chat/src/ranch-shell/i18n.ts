export type RanchLocale = "en" | "zh";

/**
 * Locale options for the language chip menu.
 * `code` = BCP-47 value; `label` = compact chip/menu text (EN / 中, not ZH).
 */
export const RANCH_LOCALE_OPTIONS: ReadonlyArray<{ code: RanchLocale; label: string }> = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中" },
];

export type RanchMessages = {
  online: string;
  busy: string;
  offline: string;
  sending: string;
  sent: string;
  queuedOffline: string;
  deliveryFailed: string;
  delivered: string;
  replying: string;
  retry: string;
  timeoutOffline: string;
  timeoutGeneric: string;
  noAgentsTitle: string;
  noAgentsBody: string;
  copyPromptForAgent: string;
  promptCopied: string;
  viewConnectGuide: string;
  pasteAgentId: string;
  waitingReply: string;
  searchAgents: string;
  discoverAgents: string;
  unreachable: string;
  sendFailed: string;
  expand: string;
  collapse: string;
  close: string;
  collapseSidebar: string;
  expandSidebar: string;
  searchChats: string;
  newChat: string;
  gatewayUnavailable: string;
  loading: string;
  noChatsYet: string;
  startChat: string;
  selectOrStart: string;
  sayHello: string;
  sayHelloOffline: string;
  offlineBanner: string;
  ownerHowToConnect: string;
  messagePlaceholder: string;
  send: string;
  justNow: string;
  minsAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
  groupChat: string;
  noMessagesYet: string;
  pickerTitle: string;
  mineAgents: string;
  recommended: string;
  noMineAgents: string;
  noRecommended: string;
  orPasteAgentId: string;
  agentIdPlaceholder: string;
  groupTitle: string;
  cancel: string;
  startChatAction: string;
  createGroup: string;
  defaultGroupTitle: string;
  logOut: string;
  account: string;
  language: string;
};

const en: RanchMessages = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  sending: "Sending",
  sent: "Sent",
  queuedOffline: "Queued (agent offline)",
  deliveryFailed: "Delivery failed",
  delivered: "Delivered",
  replying: "Replying",
  retry: "Retry",
  timeoutOffline:
    "The agent is offline. Your message was queued. Try again when they are online, or ask the owner to keep the agent listening.",
  timeoutGeneric:
    "No reply yet. The agent may be offline, or chat writeback is not set up.",
  noAgentsTitle: "No agents to chat with yet",
  noAgentsBody:
    "Registering on ACN is not enough. Copy the prompt below, paste it to your agent, and let it finish setup (installs ACN skill if needed).",
  copyPromptForAgent: "Copy prompt for agent",
  promptCopied: "Copied",
  viewConnectGuide: "Full guide",
  pasteAgentId: "Paste an agent id",
  unreachable: "Agent unreachable (offline or not listening).",
  sendFailed: "Send failed",
  expand: "Expand",
  collapse: "Collapse",
  close: "Close",
  collapseSidebar: "Hide sidebar",
  expandSidebar: "Show sidebar",
  searchChats: "Search chats…",
  newChat: "New",
  gatewayUnavailable: "Gateway unavailable",
  loading: "Loading…",
  noChatsYet: "No chats yet",
  startChat: "Start a chat",
  selectOrStart: "Select a chat or start a new one",
  sayHello: "Say hello to start the conversation.",
  sayHelloOffline: "You can still send messages while offline; replies may wait until the agent is online.",
  offlineBanner: "This agent is offline. Messages may queue — chatting is more reliable when the green dot is on.",
  ownerHowToConnect: "How owners connect",
  messagePlaceholder: "Message…",
  send: "Send",
  justNow: "Just now",
  minsAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  daysAgo: (n) => `${n}d ago`,
  groupChat: "Group chat",
  noMessagesYet: "No messages yet",
  pickerTitle: "New chat",
  mineAgents: "MY AGENTS",
  recommended: "DISCOVER",
  noMineAgents:
    "No agents under your account yet. Copy the connect prompt and paste it to your agent.",
  noRecommended: "No discoverable agents right now",
  orPasteAgentId: "Or paste agent id",
  agentIdPlaceholder: "ACN agent id…",
  groupTitle: "Group title",
  cancel: "Cancel",
  startChatAction: "Start chat",
  createGroup: "Create group",
  defaultGroupTitle: "Agent group",
  logOut: "Log out",
  account: "Account",
  language: "Language",
  waitingReply: "Waiting for reply…",
  searchAgents: "Search agents…",
  discoverAgents: "Discoverable",
};

const zh: RanchMessages = {
  online: "在线",
  busy: "忙碌",
  offline: "离线",
  sending: "发送中",
  sent: "已发送",
  queuedOffline: "已排队（对方离线）",
  deliveryFailed: "投递失败",
  delivered: "已送达",
  replying: "正在回复",
  retry: "重试",
  timeoutOffline:
    "对方当前不在线，消息已排队。等对方上线后再试，或请主人确认 agent 是否在听。",
  timeoutGeneric: "对方长时间没有回复。可能离线，或还没接上聊天回写。",
  noAgentsTitle: "还没有可聊的 agent",
  noAgentsBody:
    "注册还不够。复制下面的提示词发给你的 agent，让它自己接完（没有 ACN skill 时会先安装）。",
  copyPromptForAgent: "复制给 agent 的提示词",
  promptCopied: "已复制",
  viewConnectGuide: "完整说明",
  pasteAgentId: "粘贴 agent id 试试",
  unreachable: "对方暂时联系不上（离线或未在听）。",
  sendFailed: "发送失败",
  expand: "全屏",
  collapse: "收起",
  close: "关闭",
  collapseSidebar: "收起侧栏",
  expandSidebar: "打开侧栏",
  searchChats: "搜索会话…",
  newChat: "新建",
  gatewayUnavailable: "Gateway 不可用",
  loading: "加载中…",
  noChatsYet: "还没有会话",
  startChat: "开始聊天",
  selectOrStart: "选择一个会话，或新建聊天",
  sayHello: "打个招呼开始对话。",
  sayHelloOffline: "对方离线时也可以发消息，但可能要等上线后才有回复。",
  offlineBanner: "对方当前不在线。消息可能排队；等绿点亮起后再聊更稳。",
  ownerHowToConnect: "主人怎么接上线",
  messagePlaceholder: "输入消息…",
  send: "发送",
  justNow: "刚刚",
  minsAgo: (n) => `${n} 分钟前`,
  hoursAgo: (n) => `${n} 小时前`,
  daysAgo: (n) => `${n} 天前`,
  groupChat: "群聊",
  noMessagesYet: "暂无消息",
  pickerTitle: "新建聊天",
  mineAgents: "我的 AGENT",
  recommended: "发现",
  noMineAgents: "还没有名下的 agent。复制提示词发给你的 agent，让它自己接完。",
  noRecommended: "暂时没有可发现的 agent",
  orPasteAgentId: "或粘贴 agent id",
  agentIdPlaceholder: "ACN agent id…",
  groupTitle: "群名称",
  cancel: "取消",
  startChatAction: "开始聊天",
  createGroup: "创建群聊",
  defaultGroupTitle: "Agent 群",
  logOut: "退出登录",
  account: "账户",
  language: "语言",
  waitingReply: "等待回复…",
  searchAgents: "搜索 agent…",
  discoverAgents: "可发现",
};

const catalogs: Record<RanchLocale, RanchMessages> = { en, zh };

/** Normalize BCP-47 / host locale to supported catalog. Default English. */
export function resolveRanchLocale(locale?: string | null): RanchLocale {
  if (!locale) return "en";
  const base = locale.trim().toLowerCase().split("-")[0];
  return base === "zh" ? "zh" : "en";
}

export function ranchMessages(locale?: string | null): RanchMessages {
  return catalogs[resolveRanchLocale(locale)];
}

export const RANCH_LOCALE_STORAGE_KEY = "acnlabs.ranch-chat.locale";

export function readStoredRanchLocale(): RanchLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(RANCH_LOCALE_STORAGE_KEY);
    if (v === "en" || v === "zh") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredRanchLocale(locale: RanchLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RANCH_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
