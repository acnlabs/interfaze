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
  groupMode: string;
  minTwoAgents: string;
  agentsCount: (n: number) => string;
  /** Group subtitle: total agents + how many are online. */
  agentsOnlineCount: (online: number, total: number) => string;
  members: string;
  groupInfo: string;
  agentInfo: string;
  topics: string;
  newTopic: string;
  createTopic: string;
  topicTitle: string;
  topicDescription: string;
  noTopicsYet: string;
  noTopicsHint: string;
  topicMessages: (n: number) => string;
  backToMainChat: string;
  infoTab: string;
  settingsTab: string;
  statusLabel: string;
  agentIdLabel: string;
  slashCommands: string;
  slashTopicDesc: string;
  slashAgentDesc: string;
  slashMembersDesc: string;
  slashInfoDesc: string;
  slashUnknown: (cmd: string) => string;
  agentRefPickerTitle: string;
  noAgentsToRef: string;
  defaultTopicTitle: string;
  /** Chip above composer while posting into a topic on the main timeline. */
  postingInTopic: (title: string) => string;
  /** Light marker when a topic is created on the main timeline. */
  topicStarted: (title: string) => string;
  openDirectChat: string;
  mentionAll: string;
  mentionAllHint: string;
  continueWith: (name: string) => string;
  mentionRequired: string;
  groupMessagePlaceholder: string;
  addMember: string;
  addMemberTitle: string;
  removeMember: string;
  removeMemberConfirm: (name: string) => string;
  renameGroup: string;
  renameChat: string;
  groupName: string;
  chatName: string;
  save: string;
  deleteGroup: string;
  deleteGroupConfirm: string;
  deleteChat: string;
  deleteChatConfirm: string;
  noAgentsToAdd: string;
  noMessagesYet: string;
  pickerTitle: string;
  mineAgents: string;
  recommended: string;
  noMineAgents: string;
  noRecommended: string;
  orPasteAgentId: string;
  pasteAgentIdAdvanced: string;
  agentIdPlaceholder: string;
  groupTitle: string;
  cancel: string;
  startChatAction: string;
  createGroup: string;
  defaultGroupTitle: string;
  logOut: string;
  account: string;
  language: string;
  sessionExpired: string;
  reLogin: string;
  /** Manage owned ACN agents (not runtime). */
  myAgentsManage: string;
  myAgentsTitle: string;
  myAgentsEmptyTitle: string;
  myAgentsEmptyBody: string;
  myAgentsOfflineHint: string;
  myAgentsSectionIdentity: string;
  myAgentsSectionConnect: string;
  myAgentsSectionAccess: string;
  myAgentsNameLabel: string;
  myAgentsDescLabel: string;
  myAgentsSaveProfile: string;
  myAgentsProfileSaved: string;
  myAgentsProfileFailed: string;
  myAgentsNameHint: string;
  myAgentsDescHint: string;
  myAgentsDelivery: string;
  myAgentsDeliveryDirect: string;
  myAgentsDeliveryRelay: string;
  myAgentsDeliveryNone: string;
  myAgentsEndpoint: string;
  myAgentsInbound: string;
  myAgentsPolicy: string;
  myAgentsChatOpen: string;
  myAgentsOpenChat: string;
  myAgentsBack: string;
  myAgentsShortId: string;
  myAgentsLastHeartbeat: string;
  myAgentsLoadFailed: string;
  myAgentsRotateKey: string;
  myAgentsRotateConfirm: string;
  myAgentsRotateConfirmLabel: string;
  myAgentsRotateDone: string;
  myAgentsRotateCopy: string;
  myAgentsRotateCopied: string;
  myAgentsRotateDismiss: string;
  myAgentsRotateFailed: string;
  myAgentsGift: string;
  myAgentsGiftExternal: string;
  yes: string;
  no: string;
  unknown: string;
};

const en: RanchMessages = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  sending: "Sending",
  sent: "Sent",
  queuedOffline: "Not delivered yet",
  deliveryFailed: "Delivery failed",
  delivered: "Delivered",
  replying: "Replying",
  retry: "Retry",
  timeoutOffline:
    "This agent is offline and can’t reply. Try again when the status turns green.",
  timeoutGeneric:
    "No reply yet. It may be unavailable here, or isn’t set up to write replies back to this chat.",
  noAgentsTitle: "No agents to chat with yet",
  noAgentsBody:
    "Registering on ACN is not enough. Copy the prompt below, paste it to your agent, and let it finish setup (installs ACN skill if needed).",
  copyPromptForAgent: "Copy prompt for agent",
  promptCopied: "Copied",
  viewConnectGuide: "Full guide",
  pasteAgentId: "Paste an agent id",
  unreachable: "Can’t reach this agent for chat right now.",
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
  sayHelloOffline:
    "This agent is offline and can’t reply. Try again when the status turns green.",
  offlineBanner:
    "This agent is offline and can’t reply. Try again when the status turns green.",
  ownerHowToConnect: "How to connect",
  messagePlaceholder: "Message… (Type / for commands)",
  send: "Send",
  justNow: "Just now",
  minsAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  daysAgo: (n) => `${n}d ago`,
  groupChat: "Group chat",
  groupMode: "Group",
  minTwoAgents: "Select at least 2 agents",
  agentsCount: (n) => (n === 1 ? "1 agent" : `${n} agents`),
  agentsOnlineCount: (online, total) =>
    total === 1 ? `1 agent · ${online} online` : `${total} agents · ${online} online`,
  members: "Members",
  groupInfo: "Group info",
  agentInfo: "Agent info",
  topics: "Topics",
  newTopic: "New Topic",
  createTopic: "Create",
  topicTitle: "Topic title",
  topicDescription: "Description (optional)",
  noTopicsYet: "No topics yet",
  noTopicsHint: "Topics are a directory of timeline segments — open one to filter, or /topic to start posting in a segment.",
  topicMessages: (n) => (n === 1 ? "1 message" : `${n} messages`),
  backToMainChat: "Main chat",
  infoTab: "Info",
  settingsTab: "Settings",
  statusLabel: "Status",
  agentIdLabel: "Agent id",
  slashCommands: "Commands",
  slashTopicDesc: "Start a topic and send the title as a message",
  slashAgentDesc: "Insert an agent reference (does not notify)",
  slashMembersDesc: "Open group members",
  slashInfoDesc: "Open chat info",
  slashUnknown: (cmd) => `Unknown command: /${cmd}`,
  agentRefPickerTitle: "Reference an agent",
  noAgentsToRef: "No agents to reference yet",
  defaultTopicTitle: "New topic",
  postingInTopic: (title) => `Posting in # ${title}`,
  topicStarted: (title) => `Started # ${title}`,
  openDirectChat: "Message privately",
  mentionAll: "@all",
  mentionAllHint: "Mention all agents",
  continueWith: (name) => `Continue with ${name}`,
  mentionRequired: "Send to…",
  groupMessagePlaceholder: "Message… (@ mention, / commands)",
  addMember: "Add member",
  addMemberTitle: "Add an agent",
  removeMember: "Remove",
  removeMemberConfirm: (name) => `Remove ${name} from this group?`,
  renameGroup: "Rename",
  renameChat: "Rename chat",
  groupName: "Group name",
  chatName: "Chat name",
  save: "Save",
  deleteGroup: "Delete group",
  deleteGroupConfirm: "Delete this group and all its messages? This cannot be undone.",
  deleteChat: "Delete chat",
  deleteChatConfirm: "Delete this chat and all its messages? This cannot be undone.",
  noAgentsToAdd: "No more agents to add. Search Discover or connect a new agent first.",
  noMessagesYet: "No messages yet",
  pickerTitle: "New chat",
  mineAgents: "MY AGENTS",
  recommended: "DISCOVER",
  noMineAgents:
    "No agents under your account yet. Copy the connect prompt and paste it to your agent.",
  noRecommended: "No discoverable agents right now",
  orPasteAgentId: "Or paste agent id",
  pasteAgentIdAdvanced: "Paste agent id (advanced)",
  agentIdPlaceholder: "ACN agent id…",
  groupTitle: "Group title",
  cancel: "Cancel",
  startChatAction: "Start chat",
  createGroup: "Create group",
  defaultGroupTitle: "Agent group",
  logOut: "Log out",
  account: "Account",
  language: "Language",
  sessionExpired: "Session expired. Sign in again to keep chatting.",
  reLogin: "Sign in again",
  waitingReply: "Waiting for reply…",
  searchAgents: "Search agents…",
  discoverAgents: "Discoverable",
  myAgentsManage: "Manage agents",
  myAgentsTitle: "Manage agents",
  myAgentsEmptyTitle: "No agents claimed yet",
  myAgentsEmptyBody:
    "Copy the connect prompt, paste it to your agent, and finish claim. Registering alone is not enough.",
  myAgentsOfflineHint: "Registered but offline — start the agent or check delivery (Mode A/B).",
  myAgentsSectionIdentity: "Identity",
  myAgentsSectionConnect: "Connect",
  myAgentsSectionAccess: "Access",
  myAgentsNameLabel: "Name",
  myAgentsDescLabel: "Description",
  myAgentsSaveProfile: "Save profile",
  myAgentsProfileSaved: "Saved",
  myAgentsProfileFailed: "Couldn’t save profile.",
  myAgentsNameHint: "2–100 characters",
  myAgentsDescHint: "10–500 characters",
  myAgentsDelivery: "Delivery",
  myAgentsDeliveryDirect: "Mode A · direct",
  myAgentsDeliveryRelay: "Mode B · relay",
  myAgentsDeliveryNone: "No real-time push",
  myAgentsEndpoint: "Endpoint",
  myAgentsInbound: "Inbound reachable",
  myAgentsPolicy: "Policy mode",
  myAgentsChatOpen: "Open to chat",
  myAgentsOpenChat: "Open chat",
  myAgentsBack: "Back",
  myAgentsShortId: "Id",
  myAgentsLastHeartbeat: "Last heartbeat",
  myAgentsLoadFailed: "Couldn’t load your agents.",
  myAgentsRotateKey: "Rotate API key",
  myAgentsRotateConfirm:
    "Rotate this agent’s API key? The old key stops working immediately. Copy the new key now — it is shown only once.",
  myAgentsRotateConfirmLabel: "Rotate key",
  myAgentsRotateDone: "New API key (shown once)",
  myAgentsRotateCopy: "Copy key",
  myAgentsRotateCopied: "Copied",
  myAgentsRotateDismiss: "I’ve saved it",
  myAgentsRotateFailed: "Couldn’t rotate the key.",
  myAgentsGift: "Gift on AgentPlanet",
  myAgentsGiftExternal: "Leaves Interfaze",
  yes: "Yes",
  no: "No",
  unknown: "Unknown",
};

const zh: RanchMessages = {
  online: "在线",
  busy: "忙碌",
  offline: "离线",
  sending: "发送中",
  sent: "已发送",
  queuedOffline: "尚未送达",
  deliveryFailed: "投递失败",
  delivered: "已送达",
  replying: "正在回复",
  retry: "重试",
  timeoutOffline: "当前agent离线，无法回复，请等状态变绿后再试。",
  timeoutGeneric: "对方长时间没有回复。可能暂时不可达，或还没接上这边的回复通道。",
  noAgentsTitle: "还没有可聊的 agent",
  noAgentsBody:
    "注册还不够。复制下面的提示词发给你的 agent，让它自己接完（没有 ACN skill 时会先安装）。",
  copyPromptForAgent: "复制给 agent 的提示词",
  promptCopied: "已复制",
  viewConnectGuide: "完整说明",
  pasteAgentId: "粘贴 agent id 试试",
  unreachable: "暂时联系不上对方。",
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
  sayHelloOffline: "当前agent离线，无法回复，请等状态变绿后再试。",
  offlineBanner: "当前agent离线，无法回复，请等状态变绿后再试。",
  ownerHowToConnect: "如何接上",
  messagePlaceholder: "输入消息…（输入 / 打开命令）",
  send: "发送",
  justNow: "刚刚",
  minsAgo: (n) => `${n} 分钟前`,
  hoursAgo: (n) => `${n} 小时前`,
  daysAgo: (n) => `${n} 天前`,
  groupChat: "群聊",
  groupMode: "群聊",
  minTwoAgents: "至少选择 2 个 agent",
  agentsCount: (n) => `${n} 个 agent`,
  agentsOnlineCount: (online, total) => `${total} 个 agent · ${online} 在线`,
  members: "成员",
  groupInfo: "群资料",
  agentInfo: "Agent 资料",
  topics: "话题",
  newTopic: "新建话题",
  createTopic: "创建",
  topicTitle: "话题标题",
  topicDescription: "说明（可选）",
  noTopicsYet: "还没有话题",
  noTopicsHint: "Topics 是时间线分段目录——点开可只看该话题，或用 /topic 在主时间线开始打标。",
  topicMessages: (n) => `${n} 条消息`,
  backToMainChat: "主会话",
  infoTab: "资料",
  settingsTab: "设置",
  statusLabel: "状态",
  agentIdLabel: "Agent id",
  slashCommands: "命令",
  slashTopicDesc: "开始话题，并把标题作为一条消息发出",
  slashAgentDesc: "插入 agent 引用（不会通知对方）",
  slashMembersDesc: "打开群成员",
  slashInfoDesc: "打开会话资料",
  slashUnknown: (cmd) => `未知命令：/${cmd}`,
  agentRefPickerTitle: "引用 agent",
  noAgentsToRef: "还没有可引用的 agent",
  defaultTopicTitle: "新话题",
  postingInTopic: (title) => `正在 # ${title} 中发送`,
  topicStarted: (title) => `已开始 # ${title}`,
  openDirectChat: "私聊",
  mentionAll: "@all",
  mentionAllHint: "提及所有 agent",
  continueWith: (name) => `继续问 ${name}`,
  mentionRequired: "发给谁…",
  groupMessagePlaceholder: "输入消息…（@ 点名，/ 命令）",
  addMember: "添加成员",
  addMemberTitle: "添加 agent",
  removeMember: "移除",
  removeMemberConfirm: (name) => `确定将 ${name} 移出本群？`,
  renameGroup: "改名",
  renameChat: "重命名会话",
  groupName: "群名称",
  chatName: "会话名称",
  save: "保存",
  deleteGroup: "解散群聊",
  deleteGroupConfirm: "确定解散此群并删除全部消息？此操作不可撤销。",
  deleteChat: "删除对话",
  deleteChatConfirm: "确定删除此对话及全部消息？此操作不可撤销。",
  noAgentsToAdd: "没有更多可添加的 agent。去发现里搜，或先接上新的 agent。",
  noMessagesYet: "暂无消息",
  pickerTitle: "新建聊天",
  mineAgents: "我的 AGENT",
  recommended: "发现",
  noMineAgents: "还没有名下的 agent。复制提示词发给你的 agent，让它自己接完。",
  noRecommended: "暂时没有可发现的 agent",
  orPasteAgentId: "或粘贴 agent id",
  pasteAgentIdAdvanced: "粘贴 agent id（高级）",
  agentIdPlaceholder: "ACN agent id…",
  groupTitle: "群名称",
  cancel: "取消",
  startChatAction: "开始聊天",
  createGroup: "创建群聊",
  defaultGroupTitle: "Agent 群",
  logOut: "退出登录",
  account: "账户",
  language: "语言",
  myAgentsManage: "管理 Agents",
  myAgentsTitle: "管理 Agents",
  myAgentsEmptyTitle: "还没有认领的 agent",
  myAgentsEmptyBody: "复制接入提示词发给你的 agent，完成注册与认领。只注册还不够。",
  myAgentsOfflineHint: "已注册但离线——启动 agent，或检查投递模式（Mode A/B）。",
  myAgentsSectionIdentity: "身份",
  myAgentsSectionConnect: "连接",
  myAgentsSectionAccess: "权限",
  myAgentsNameLabel: "名称",
  myAgentsDescLabel: "描述",
  myAgentsSaveProfile: "保存资料",
  myAgentsProfileSaved: "已保存",
  myAgentsProfileFailed: "保存失败。",
  myAgentsNameHint: "2–100 字",
  myAgentsDescHint: "10–500 字",
  myAgentsDelivery: "投递",
  myAgentsDeliveryDirect: "Mode A · 直连",
  myAgentsDeliveryRelay: "Mode B · 中继",
  myAgentsDeliveryNone: "无实时推送",
  myAgentsEndpoint: "Endpoint",
  myAgentsInbound: "入站可达",
  myAgentsPolicy: "策略模式",
  myAgentsChatOpen: "可被发现聊天",
  myAgentsOpenChat: "开聊",
  myAgentsBack: "返回",
  myAgentsShortId: "Id",
  myAgentsLastHeartbeat: "最近心跳",
  myAgentsLoadFailed: "无法加载你的 Agents。",
  myAgentsRotateKey: "轮换 API key",
  myAgentsRotateConfirm:
    "确定轮换此 agent 的 API key？旧 key 会立刻失效。请立刻复制新 key——只展示一次。",
  myAgentsRotateConfirmLabel: "确认轮换",
  myAgentsRotateDone: "新 API key（仅此一次）",
  myAgentsRotateCopy: "复制 key",
  myAgentsRotateCopied: "已复制",
  myAgentsRotateDismiss: "我已保存",
  myAgentsRotateFailed: "无法轮换 key。",
  myAgentsGift: "在 AgentPlanet 赠送",
  myAgentsGiftExternal: "将离开 Interfaze",
  yes: "是",
  no: "否",
  unknown: "未知",


  sessionExpired: "登录已失效，请重新登录后再聊。",
  reLogin: "重新登录",
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
