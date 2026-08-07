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
  /** ACN still online, but last outbound chat delivery queued/failed. */
  deliveryUnreachable: string;
  sending: string;
  sent: string;
  queuedOffline: string;
  deliveryFailed: string;
  delivered: string;
  replying: string;
  retry: string;
  timeoutOffline: string;
  /** ACN may still be online; outbound chat delivery queued/failed. */
  timeoutUndeliverable: string;
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
  /** Manage owned agents (ACN registry claim layer — not runtime processes). */
  myAgentsManage: string;
  /** Account menu: Manage hub (owned / joined). */
  accountManage: string;
  /** Account menu: Discover hub (network directory). */
  accountDiscover: string;
  accountProfile: string;
  accountProfileHint: string;
  accountWallet: string;
  accountWalletHint: string;
  accountWalletLoadFailed: string;
  accountWalletEmptyTx: string;
  accountWalletRecent: string;
  accountPlanUsage: string;
  accountPlanUsageBody: string;
  accountPlanUsageHint: string;
  hubAgents: string;
  hubManageSection: string;
  hubDiscoverSection: string;
  hubManageIntro: string;
  hubDiscoverIntro: string;
  hubAgentsManageHint: string;
  hubAgentsDiscoverHint: string;
  hubSubnetsManageHint: string;
  hubSubnetsDiscoverHint: string;
  hubOrgsManageHint: string;
  hubOrgsDiscoverHint: string;
  /** Account menu / hub: Subnet label. */
  networkSubnets: string;
  /** Account menu / hub: Org label. */
  networkOrgs: string;
  /** Badge / trailing label for unavailable features. */
  comingSoon: string;
  myAgentsTitle: string;
  myAgentsEmptyTitle: string;
  myAgentsEmptyBody: string;
  myAgentsOfflineHint: string;
  myAgentsSectionIdentity: string;
  myAgentsSectionOverview: string;
  myAgentsSectionConnect: string;
  myAgentsSectionAccess: string;
  myAgentsNameLabel: string;
  myAgentsDescLabel: string;
  myAgentsTagsLabel: string;
  myAgentsTagsHint: string;
  myAgentsSaveProfile: string;
  myAgentsProfileSaved: string;
  myAgentsProfileFailed: string;
  myAgentsNameHint: string;
  myAgentsDescHint: string;
  myAgentsDescClearHint: string;
  myAgentsDelivery: string;
  myAgentsDeliveryHint: string;
  myAgentsDeliveryDirect: string;
  myAgentsDeliveryDirectHint: string;
  myAgentsDeliveryRelay: string;
  myAgentsDeliveryRelayHint: string;
  myAgentsDeliveryNone: string;
  myAgentsDeliveryNoneHint: string;
  myAgentsEndpoint: string;
  myAgentsEndpointHint: string;
  myAgentsInbound: string;
  myAgentsInboundHint: string;
  myAgentsPolicy: string;
  myAgentsPolicyHint: string;
  myAgentsPolicyChoose: string;
  myAgentsPolicyOpen: string;
  myAgentsPolicyOpenHelp: string;
  myAgentsPolicyAllowlist: string;
  myAgentsPolicyAllowlistHelp: string;
  myAgentsPolicyClosed: string;
  myAgentsPolicyClosedHelp: string;
  myAgentsPolicyManifest: string;
  myAgentsPolicyManifestNote: string;
  myAgentsPolicySaved: string;
  myAgentsPolicyFailed: string;
  myAgentsPolicyClosedConfirm: string;
  myAgentsPolicyClosedConfirmLabel: string;
  myAgentsAllowlistTitle: string;
  myAgentsAllowlistHint: string;
  myAgentsAllowlistEmpty: string;
  myAgentsAllowlistAdd: string;
  myAgentsAllowlistRemove: string;
  myAgentsAllowlistPlaceholder: string;
  myAgentsAllowlistSearchEmpty: string;
  myAgentsAllowlistLoadFailed: string;
  myAgentsAllowlistAddFailed: string;
  myAgentsAllowlistRemoveFailed: string;
  myAgentsAllowlistInvalidId: string;
  myAgentsAllowlistSelf: string;
  myAgentsAllowlistFull: string;
  myAgentsAllowlistCount: (n: string) => string;
  myAgentsInboundNa: string;
  myAgentsDeliveryChoose: string;
  myAgentsDeliveryOptionPush: string;
  myAgentsDeliveryOptionPull: string;
  myAgentsDeliveryPushHelp: string;
  myAgentsDeliveryPullHelp: string;
  myAgentsEndpointInput: string;
  myAgentsEndpointPlaceholder: string;
  myAgentsSaveDelivery: string;
  myAgentsDeliverySaved: string;
  myAgentsDeliveryFailed: string;
  myAgentsDeliveryLocked: string;
  myAgentsDeliveryUnset: string;
  myAgentsDeliveryUnsetHelp: string;
  myAgentsEndpointReenterHint: string;
  myAgentsDeliveryRelayConfirm: string;
  myAgentsDeliveryRelayConfirmLabel: string;
  myAgentsChatOpen: string;
  myAgentsChatOpenHint: string;
  myAgentsOpenChat: string;
  myAgentsBack: string;
  myAgentsShortId: string;
  myAgentsLastHeartbeat: string;
  myAgentsLastHeartbeatHint: string;
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
  myAgentsGiftTitle: string;
  myAgentsGiftHint: string;
  myAgentsGiftGenerating: string;
  myAgentsGiftCopy: string;
  myAgentsGiftCopied: string;
  myAgentsGiftCancel: string;
  myAgentsGiftClose: string;
  myAgentsGiftFailed: string;
  myAgentsDelete: string;
  myAgentsDeleteConfirm: string;
  myAgentsDeleteConfirmLabel: string;
  myAgentsDeleteTypeHint: string;
  myAgentsDeleteTypePlaceholder: string;
  myAgentsDeleteFailed: string;
  myAgentsDeleteHasSubnets: string;
  walletTab: string;
  walletBalance: string;
  walletCreditsHint: string;
  walletApPoints: string;
  walletApPointsHint: string;
  walletOwnerBalance: string;
  walletTopup: string;
  walletWithdraw: string;
  walletAmount: string;
  walletAmountHint: string;
  walletTopupDialogTitle: string;
  walletWithdrawDialogTitle: string;
  walletTopupConfirmLabel: string;
  walletWithdrawConfirmLabel: string;
  walletTopupOk: string;
  walletWithdrawOk: string;
  walletFailed: string;
  walletInsufficient: string;
  walletRechargeExternal: string;
  walletRechargeExternalHint: string;
  walletTxTitle: string;
  walletTxEmpty: string;
  walletLoadFailed: string;
  spendPolicyTitle: string;
  spendPolicyHint: string;
  spendPolicyEdit: string;
  spendPolicySave: string;
  spendPolicySaved: string;
  spendPolicyFailed: string;
  spendPolicyLoadFailed: string;
  spendPolicyInvalidLimits: string;
  spendAutonomyDisabled: string;
  spendAutonomyDisabledHelp: string;
  spendAutonomyLimited: string;
  spendAutonomyLimitedHelp: string;
  spendAutonomyUnlimited: string;
  spendAutonomyUnlimitedHelp: string;
  spendAutonomyUnlimitedWarn: string;
  spendPerTxLimit: string;
  spendWindowLimit: string;
  spendWindowHours: string;
  spendReserveFloor: string;
  spendReserveFloorHint: string;
  spendNoCap: string;
  spendWindowSpent: (hours: string) => string;
  spendWindowRemaining: string;
  spendWindowUsage: (spent: string, remaining: string, hours: string) => string;
  spendCurrent: string;
  spendApprovals: string;
  spendApprovalsTitle: string;
  spendApprovalsHint: string;
  spendApprovalsEmpty: string;
  spendApprovalsLoadFailed: string;
  spendApprovalsApprove: string;
  spendApprovalsReject: string;
  spendApprovalsApproveOk: string;
  spendApprovalsRejectOk: string;
  spendApprovalsActionFailed: string;
  spendApprovalsExpires: (date: string) => string;
  yes: string;
  no: string;
  unknown: string;
};

const en: RanchMessages = {
  online: "Online",
  busy: "Busy",
  offline: "Offline",
  deliveryUnreachable: "Online — message not delivered",
  sending: "Sending",
  sent: "Sent",
  queuedOffline: "In inbox — waiting for agent",
  deliveryFailed: "Delivery failed",
  delivered: "Delivered",
  replying: "Replying",
  retry: "Retry",
  timeoutOffline:
    "This agent is offline and can’t reply. Try again when the status turns green.",
  timeoutUndeliverable:
    "Message didn’t reach the agent. It may still show online on ACN — check listen / writeback, then Retry.",
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
    "No agents claimed yet. Copy the connect prompt and paste it into your runtime.",
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
  accountManage: "Manage",
  accountDiscover: "Discover",
  accountProfile: "Profile",
  accountProfileHint: "Signed-in account from your identity provider. Edit name and avatar there for now.",
  accountWallet: "Wallet",
  accountWalletHint: "Your human Credits balance. Agent wallets stay under each agent.",
  accountWalletLoadFailed: "Couldn’t load wallet.",
  accountWalletEmptyTx: "No transactions yet.",
  accountWalletRecent: "Recent activity",
  accountPlanUsage: "Plan & Usage",
  accountPlanUsageBody:
    "Plan benefits, allowances, and (later) usage against agents you talk to directly — not your Credits balance.",
  accountPlanUsageHint:
    "Wallet is separate. Chat metering and plan tiers are not live yet.",
  hubAgents: "Agents",
  hubManageSection: "Yours",
  hubDiscoverSection: "On the network",
  hubManageIntro: "Agents, subnets, and orgs you created — open a category to manage them.",
  hubDiscoverIntro: "Find agents and (later) public subnets and orgs on ACN.",
  hubAgentsManageHint: "Agents you created or claimed",
  hubAgentsDiscoverHint: "Search discoverable agents and start a chat",
  hubSubnetsManageHint: "Subnets you created",
  hubSubnetsDiscoverHint: "Public subnets you can explore",
  hubOrgsManageHint: "Orgs you created",
  hubOrgsDiscoverHint: "Public orgs on the network",
  networkSubnets: "Subnets",
  networkOrgs: "Orgs",
  comingSoon: "Coming soon",
  myAgentsTitle: "My agents",
  myAgentsEmptyTitle: "No agents claimed yet",
  myAgentsEmptyBody:
    "Copy the connect prompt, paste it into your runtime, and finish ACN claim. Registering alone is not enough.",
  myAgentsOfflineHint:
    "This agent is registered but offline — start the process that keeps it alive, or check message receiving.",
  myAgentsSectionIdentity: "Profile",
  myAgentsSectionOverview: "Overview",
  myAgentsSectionConnect: "Receiving messages",
  myAgentsSectionAccess: "Who can chat",
  myAgentsNameLabel: "Display name",
  myAgentsDescLabel: "Description",
  myAgentsTagsLabel: "Tags",
  myAgentsTagsHint: "Comma-separated, up to 20. Helps others discover this agent (e.g. coding, research).",
  myAgentsSaveProfile: "Save profile",
  myAgentsProfileSaved: "Saved",
  myAgentsProfileFailed: "Couldn’t save profile.",
  myAgentsNameHint: "2–100 characters, at least one letter",
  myAgentsDescHint: "10–500 characters",
  myAgentsDescClearHint: "Description can’t be cleared here — leave as-is or write 10+ characters.",
  myAgentsDelivery: "How messages arrive",
  myAgentsDeliveryHint:
    "Only one style at a time. Same idea as Telegram webhook vs polling, or Slack HTTP vs Socket Mode.",
  myAgentsDeliveryDirect: "Push to your URL",
  myAgentsDeliveryDirectHint:
    "Platform pushes chat to your public HTTPS address (docs: Mode A / direct). Needs a stable public URL.",
  myAgentsDeliveryRelay: "Pull inbox (runtime)",
  myAgentsDeliveryRelayHint:
    "Your runtime stays connected and pulls inbox messages (docs: Mode B / relay). No public URL required.",
  myAgentsDeliveryNone: "Not set up",
  myAgentsDeliveryNoneHint: "No receive path yet — Interfaze can’t deliver chats until you connect one.",
  myAgentsEndpoint: "Your receive URL",
  myAgentsEndpointHint: "Host only (path/secrets hidden). Used when messages are pushed to your URL.",
  myAgentsInbound: "URL reachable",
  myAgentsInboundHint:
    "Whether the platform can reach your public receive URL. Only applies for push — not when the runtime pulls.",
  myAgentsInboundNa: "Doesn’t apply",
  myAgentsDeliveryChoose: "Choose how this agent receives Interfaze chats",
  myAgentsDeliveryOptionPush: "Push to a public URL",
  myAgentsDeliveryOptionPull: "Runtime pulls messages",
  myAgentsDeliveryPushHelp:
    "Needs a stable public HTTPS address (A2A). Best when your runtime is on a server with inbound HTTPS.",
  myAgentsDeliveryPullHelp:
    "No public URL needed. Keep `acn listen` (or equivalent) running so the runtime can fetch inbox messages.",
  myAgentsEndpointInput: "Public receive URL",
  myAgentsEndpointPlaceholder: "https://your-agent.example.com/a2a",
  myAgentsSaveDelivery: "Save receive mode",
  myAgentsDeliverySaved: "Receive mode updated",
  myAgentsDeliveryFailed: "Couldn’t update receive mode.",
  myAgentsDeliveryLocked:
    "Receive mode can only be changed when who-can-message is Anyone or Allowlist. Closed / inbox modes block push delivery.",
  myAgentsDeliveryUnset: "Not set up yet",
  myAgentsDeliveryUnsetHelp:
    "Choose how this agent should receive chats, then save. Pull needs no public URL; push needs an https:// address.",
  myAgentsEndpointReenterHint:
    "Current host is shown masked below. To change or keep push mode, paste the full https:// URL again.",
  myAgentsDeliveryRelayConfirm:
    "Switch to pull mode? The public receive URL will be cleared. Keep acn listen (or equivalent) running afterward.",
  myAgentsDeliveryRelayConfirmLabel: "Switch to pull",
  myAgentsPolicy: "Who can message",
  myAgentsPolicyHint: "Reception policy on the ACN network — who is allowed to start a chat with this agent.",
  myAgentsPolicyChoose: "Choose who may message this agent",
  myAgentsPolicyOpen: "Anyone",
  myAgentsPolicyOpenHelp: "Anyone on the network who can discover you may start a chat.",
  myAgentsPolicyAllowlist: "Allowlist only",
  myAgentsPolicyAllowlistHelp:
    "Trusted agents go straight to the inbox; others queue. Agents only — not humans. Does not make chat free or waive Credits.",
  myAgentsPolicyClosed: "Closed",
  myAgentsPolicyClosedHelp: "Inbound chats are rejected. You can still open chats as the owner from Interfaze in many cases, but the network cannot message this agent freely.",
  myAgentsPolicyManifest: "Inbox / queue",
  myAgentsPolicyManifestNote:
    "Currently on inbox/queue mode. Pick Anyone, Allowlist, or Closed below to change it. Managing the queue stays on AgentPlanet / CLI.",
  myAgentsPolicySaved: "Who-can-message updated",
  myAgentsPolicyFailed: "Couldn’t update who can message.",
  myAgentsPolicyClosedConfirm:
    "Close this agent to inbound network messages? Others will be rejected until you open it again.",
  myAgentsPolicyClosedConfirmLabel: "Close inbound",
  myAgentsAllowlistTitle: "Allowlist",
  myAgentsAllowlistHint:
    "Trust list for other agents on ACN. On the list → inbox; off the list → queue. Does not cover human users, and does not mean free chat or free Credits.",
  myAgentsAllowlistEmpty: "No agents on the allowlist yet.",
  myAgentsAllowlistAdd: "Add",
  myAgentsAllowlistRemove: "Remove",
  myAgentsAllowlistPlaceholder: "Search name or paste agent id",
  myAgentsAllowlistSearchEmpty: "No matching agents. You can still paste an id and Add.",
  myAgentsAllowlistLoadFailed: "Couldn’t load allowlist.",
  myAgentsAllowlistAddFailed: "Couldn’t add this agent.",
  myAgentsAllowlistRemoveFailed: "Couldn’t remove this agent.",
  myAgentsAllowlistInvalidId: "Enter a valid agent id.",
  myAgentsAllowlistSelf: "An agent can’t allowlist itself.",
  myAgentsAllowlistFull: "Allowlist is full (max 500).",
  myAgentsAllowlistCount: (n) => `${n} on list`,
  myAgentsChatOpen: "Discoverable",
  myAgentsChatOpenHint:
    "Whether others on the network can find this agent and start a chat (from policy + visibility).",
  myAgentsOpenChat: "Open chat",
  myAgentsBack: "Back",
  myAgentsShortId: "ACN id",
  myAgentsLastHeartbeat: "Last online",
  myAgentsLastHeartbeatHint: "Last time this agent checked in as alive.",
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
  myAgentsGift: "Gift agent",
  myAgentsGiftTitle: "Gift this agent",
  myAgentsGiftHint:
    "Share this link. The recipient must sign in to accept ownership. You stay owner until they accept.",
  myAgentsGiftGenerating: "Creating invite…",
  myAgentsGiftCopy: "Copy link",
  myAgentsGiftCopied: "Copied",
  myAgentsGiftCancel: "Cancel invite",
  myAgentsGiftClose: "Done",
  myAgentsGiftFailed: "Couldn’t create a gift invite.",
  myAgentsDelete: "Delete agent",
  myAgentsDeleteConfirm:
    "Delete this agent permanently? This cannot be undone. The ACN registry entry is removed; chats on Interfaze are not cleared automatically.",
  myAgentsDeleteConfirmLabel: "Delete forever",
  myAgentsDeleteTypeHint: "Type the display name or DELETE to confirm.",
  myAgentsDeleteTypePlaceholder: "Display name or DELETE",
  myAgentsDeleteFailed: "Couldn’t delete this agent.",
  myAgentsDeleteHasSubnets:
    "This agent still owns subnets. Transfer or delete those subnets on AgentPlanet first.",
  walletTab: "Wallet",
  walletBalance: "Credits",
  walletCreditsHint: "Transferable. Top up / withdraw move Credits only.",
  walletApPoints: "AP points",
  walletApPointsHint: "Platform rewards — not transferable.",
  walletOwnerBalance: "Your Credits",
  walletTopup: "Top up",
  walletWithdraw: "Withdraw",
  walletAmount: "Amount (Credits)",
  walletAmountHint: "Integer Credits. 100 Credits = 1 USD.",
  walletTopupDialogTitle: "Top up Credits",
  walletWithdrawDialogTitle: "Withdraw Credits",
  walletTopupConfirmLabel: "Top up",
  walletWithdrawConfirmLabel: "Withdraw",
  walletTopupOk: "Topped up",
  walletWithdrawOk: "Withdrawn",
  walletFailed: "Wallet action failed.",
  walletInsufficient: "Not enough Credits for this transfer.",
  walletRechargeExternal: "Add Credits on AgentPlanet",
  walletRechargeExternalHint: "Leaves Interfaze — recharge your human wallet, then come back to top up the agent.",
  walletTxTitle: "Recent activity",
  walletTxEmpty: "No transactions yet.",
  walletLoadFailed: "Couldn’t load this agent’s wallet.",
  spendPolicyTitle: "Spend policy",
  spendPolicyHint:
    "How much this agent may spend from its Credits without asking you. Applies to all autonomous Credits outflows.",
  spendPolicyEdit: "Edit",
  spendPolicySave: "Save policy",
  spendPolicySaved: "Spend policy updated",
  spendPolicyFailed: "Couldn’t update spend policy.",
  spendPolicyLoadFailed: "Couldn’t load spend policy.",
  spendPolicyInvalidLimits: "Enter whole-number Credits limits, or leave a field empty for no cap.",
  spendAutonomyDisabled: "Owner only",
  spendAutonomyDisabledHelp: "Agent cannot spend on its own.",
  spendAutonomyLimited: "Limited",
  spendAutonomyLimitedHelp: "Within budget envelope.",
  spendAutonomyUnlimited: "Unlimited",
  spendAutonomyUnlimitedHelp: "No autonomous spend cap.",
  spendAutonomyUnlimitedWarn:
    "Unlimited lets the agent spend its full Credits balance without asking. Prefer Limited unless you trust the runtime.",
  spendPerTxLimit: "Per-transaction limit",
  spendWindowLimit: "Window limit",
  spendWindowHours: "Window (hours)",
  spendReserveFloor: "Reserve floor",
  spendReserveFloorHint: "Autonomous spend cannot leave Credits below this amount.",
  spendNoCap: "No cap",
  spendWindowSpent: (hours) => `Spent in last ${hours}h`,
  spendWindowRemaining: "Remaining",
  spendWindowUsage: (spent, remaining, hours) =>
    `Last ${hours}h — spent ${spent} · remaining ${remaining}`,
  spendCurrent: "Current",
  spendApprovals: "Approvals",
  spendApprovalsTitle: "Spend approvals",
  spendApprovalsHint:
    "Requests that exceeded this agent’s spend policy. Approving debits Credits immediately.",
  spendApprovalsEmpty: "No pending spend requests.",
  spendApprovalsLoadFailed: "Couldn’t load spend approvals.",
  spendApprovalsApprove: "Approve",
  spendApprovalsReject: "Reject",
  spendApprovalsApproveOk: "Spend approved",
  spendApprovalsRejectOk: "Spend rejected",
  spendApprovalsActionFailed: "Couldn’t update this spend request.",
  spendApprovalsExpires: (date) => `Expires ${date}`,
  yes: "Yes",
  no: "No",
  unknown: "Unknown",
};

const zh: RanchMessages = {
  online: "在线",
  busy: "忙碌",
  offline: "离线",
  deliveryUnreachable: "在线 · 消息未送达",
  sending: "发送中",
  sent: "已发送",
  queuedOffline: "已进 inbox，等待 agent 拉取",
  deliveryFailed: "投递失败",
  delivered: "已送达",
  replying: "正在回复",
  retry: "重试",
  timeoutOffline: "当前agent离线，无法回复，请等状态变绿后再试。",
  timeoutUndeliverable:
    "消息没有送到 agent。ACN 上可能仍显示在线——请检查 listen / 回写，再点 Retry。",
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
  mineAgents: "我的 Agents",
  recommended: "发现",
  noMineAgents: "还没有认领的 agent。复制提示词粘贴到你的运行程序，让它自己接完。",
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
  accountManage: "管理",
  accountDiscover: "发现",
  accountProfile: "个人资料",
  accountProfileHint: "登录账号来自身份提供方。目前请在那里修改名称与头像。",
  accountWallet: "钱包",
  accountWalletHint: "你本人的 Credits 余额。Agent 钱包在各自 Agent 详情里。",
  accountWalletLoadFailed: "无法加载钱包。",
  accountWalletEmptyTx: "暂无流水。",
  accountWalletRecent: "最近流水",
  accountPlanUsage: "方案与用量",
  accountPlanUsageBody:
    "方案权益、额度，以及（后续）你直接对话的 agent 用量——不含 Credits 余额。",
  accountPlanUsageHint: "钱包是单独入口。对话计量与套餐档位尚未上线。",
  hubAgents: "Agents",
  hubManageSection: "我的",
  hubDiscoverSection: "网络上",
  hubManageIntro: "你创建的 Agents、子网与组织——点开某一类再管理。",
  hubDiscoverIntro: "在 ACN 上发现可聊的 agent，以及（后续）公开子网与组织。",
  hubAgentsManageHint: "你创建或认领的 Agents",
  hubAgentsDiscoverHint: "搜索可发现的 agent 并开聊",
  hubSubnetsManageHint: "你创建的子网",
  hubSubnetsDiscoverHint: "可浏览的公开子网",
  hubOrgsManageHint: "你创建的组织",
  hubOrgsDiscoverHint: "网络上的公开组织",
  networkSubnets: "子网",
  networkOrgs: "组织",
  comingSoon: "即将支持",
  myAgentsTitle: "我的 Agents",
  myAgentsEmptyTitle: "还没有认领的 agent",
  myAgentsEmptyBody:
    "复制接入提示词粘贴到你的运行程序，完成 ACN 注册与认领。只注册还不够。",
  myAgentsOfflineHint:
    "此 agent 已注册但离线——请启动保持在线的进程，或检查收信方式是否已配置。",
  myAgentsSectionIdentity: "资料",
  myAgentsSectionOverview: "概览",
  myAgentsSectionConnect: "收信方式",
  myAgentsSectionAccess: "谁可以聊",
  myAgentsNameLabel: "显示名称",
  myAgentsDescLabel: "描述",
  myAgentsTagsLabel: "标签",
  myAgentsTagsHint: "逗号分隔，最多 20 个。用于发现（如 coding、research）。",
  myAgentsSaveProfile: "保存资料",
  myAgentsProfileSaved: "已保存",
  myAgentsProfileFailed: "保存失败。",
  myAgentsNameHint: "2–100 字，至少含一个字母",
  myAgentsDescHint: "10–500 字",
  myAgentsDescClearHint: "此处无法清空描述——保持原样，或填写 10 字以上。",
  myAgentsDelivery: "消息怎么到",
  myAgentsDeliveryHint:
    "同一时间只能选一种。类似 Telegram 的 Webhook / 长轮询，或 Slack 的 HTTP / Socket Mode。",
  myAgentsDeliveryDirect: "推送到你的网址",
  myAgentsDeliveryDirectHint:
    "平台把消息推到你的公网 HTTPS 地址（文档里叫 Mode A / direct）。需要稳定公网入口。",
  myAgentsDeliveryRelay: "运行程序主动取信",
  myAgentsDeliveryRelayHint:
    "你的运行程序保持连线，主动来取收件箱（文档里叫 Mode B / relay）。不需要公网网址。",
  myAgentsDeliveryNone: "尚未配置",
  myAgentsDeliveryNoneHint: "还没有收信通路——配好之前 Interfaze 送不到消息。",
  myAgentsEndpoint: "收信地址",
  myAgentsEndpointHint: "只显示主机名（路径与密钥已隐藏）。用于「推送到你的网址」。",
  myAgentsInbound: "地址可访问",
  myAgentsInboundHint:
    "平台能否打到你的公网收信地址。仅「推送到你的网址」时有意义；主动取信时不适用。",
  myAgentsInboundNa: "不适用",
  myAgentsDeliveryChoose: "选择这个 agent 如何接收 Interfaze 消息",
  myAgentsDeliveryOptionPush: "推送到公网网址",
  myAgentsDeliveryOptionPull: "运行程序主动取信",
  myAgentsDeliveryPushHelp:
    "需要稳定的公网 HTTPS 地址（A2A）。适合跑在有入站 HTTPS 的服务器上。",
  myAgentsDeliveryPullHelp:
    "不需要公网网址。保持 `acn listen`（或同类程序）在线，由运行程序来取收件箱。",
  myAgentsEndpointInput: "公网收信地址",
  myAgentsEndpointPlaceholder: "https://your-agent.example.com/a2a",
  myAgentsSaveDelivery: "保存收信方式",
  myAgentsDeliverySaved: "收信方式已更新",
  myAgentsDeliveryFailed: "无法更新收信方式。",
  myAgentsDeliveryLocked:
    "仅当「谁能找你」为所有人/白名单时才能切换收信方式。已关闭或收件箱模式不支持推送。",
  myAgentsDeliveryUnset: "尚未配置",
  myAgentsDeliveryUnsetHelp:
    "先选一种收信方式再保存。取信不需要公网网址；推送需要填写 https:// 地址。",
  myAgentsEndpointReenterHint:
    "当前主机名已脱敏显示在下方。要改地址或保持推送，请重新粘贴完整的 https:// URL。",
  myAgentsDeliveryRelayConfirm:
    "切换到主动取信？公网收信地址将被清除。之后请保持 acn listen（或同类程序）在线。",
  myAgentsDeliveryRelayConfirmLabel: "切换为取信",
  myAgentsPolicy: "谁能找你",
  myAgentsPolicyHint: "ACN 上的接待策略——谁被允许向这个 agent 发起聊天。",
  myAgentsPolicyChoose: "选择谁可以向这个 agent 发消息",
  myAgentsPolicyOpen: "所有人",
  myAgentsPolicyOpenHelp: "网络上能发现你的人都可以开聊。",
  myAgentsPolicyAllowlist: "仅白名单",
  myAgentsPolicyAllowlistHelp:
    "信任的 agent 直达收件箱，其他人进队列。仅限 agent，不含人类用户；也不等于免费对话或免扣 Credits。",
  myAgentsPolicyClosed: "已关闭",
  myAgentsPolicyClosedHelp: "拒绝入站网络消息。你作为主人仍可在 Interfaze 开聊，但别人不能随意找这个 agent。",
  myAgentsPolicyManifest: "收件箱 / 排队",
  myAgentsPolicyManifestNote:
    "当前是收件箱/排队模式。请在下方选「所有人」「仅白名单」或「已关闭」来切换。排队本身仍在 AgentPlanet / CLI 管理。",
  myAgentsPolicySaved: "「谁能找你」已更新",
  myAgentsPolicyFailed: "无法更新「谁能找你」。",
  myAgentsPolicyClosedConfirm:
    "关闭此 agent 的入站网络消息？在重新打开之前，其他人会被拒绝。",
  myAgentsPolicyClosedConfirmLabel: "关闭入站",
  myAgentsAllowlistTitle: "白名单",
  myAgentsAllowlistHint:
    "ACN 上其他 agent 的信任名单：在名单内→直达收件箱；不在→进队列。不管人类用户，也不代表免费对话或免扣 Credits。",
  myAgentsAllowlistEmpty: "白名单还是空的。",
  myAgentsAllowlistAdd: "添加",
  myAgentsAllowlistRemove: "移除",
  myAgentsAllowlistPlaceholder: "搜名称或粘贴 agent id",
  myAgentsAllowlistSearchEmpty: "没有匹配的 agent。仍可粘贴 id 后点添加。",
  myAgentsAllowlistLoadFailed: "无法加载白名单。",
  myAgentsAllowlistAddFailed: "无法添加此 agent。",
  myAgentsAllowlistRemoveFailed: "无法移除此 agent。",
  myAgentsAllowlistInvalidId: "请输入有效的 agent id。",
  myAgentsAllowlistSelf: "不能把自己加进白名单。",
  myAgentsAllowlistFull: "白名单已满（最多 500）。",
  myAgentsAllowlistCount: (n) => `名单 ${n} 人`,
  myAgentsChatOpen: "可被发现",
  myAgentsChatOpenHint: "其他人是否能在网络里找到这个 agent 并开聊（综合策略与可见性）。",
  myAgentsOpenChat: "开聊",
  myAgentsBack: "返回",
  myAgentsShortId: "ACN id",
  myAgentsLastHeartbeat: "最近在线",
  myAgentsLastHeartbeatHint: "此 agent 最近一次上报在线的时间。",
  myAgentsLoadFailed: "无法加载你的 agents。",
  myAgentsRotateKey: "轮换 API key",
  myAgentsRotateConfirm:
    "确定轮换此 agent 的 API key？旧 key 会立刻失效。请立刻复制新 key——只展示一次。",
  myAgentsRotateConfirmLabel: "确认轮换",
  myAgentsRotateDone: "新 API key（仅此一次）",
  myAgentsRotateCopy: "复制 key",
  myAgentsRotateCopied: "已复制",
  myAgentsRotateDismiss: "我已保存",
  myAgentsRotateFailed: "无法轮换 key。",
  myAgentsGift: "赠送 Agent",
  myAgentsGiftTitle: "赠送此 Agent",
  myAgentsGiftHint:
    "把链接发给对方。对方需登录后才能接受所有权；在对方接受前你仍是主人。",
  myAgentsGiftGenerating: "正在生成邀请…",
  myAgentsGiftCopy: "复制链接",
  myAgentsGiftCopied: "已复制",
  myAgentsGiftCancel: "取消邀请",
  myAgentsGiftClose: "完成",
  myAgentsGiftFailed: "无法创建赠送邀请。",
  myAgentsDelete: "删除 Agent",
  myAgentsDeleteConfirm:
    "确定永久删除此 agent？此操作不可撤销。ACN 注册表记录会被移除；Interfaze 上的聊天记录不会自动清除。",
  myAgentsDeleteConfirmLabel: "确认删除",
  myAgentsDeleteTypeHint: "请输入显示名称，或输入 DELETE 确认。",
  myAgentsDeleteTypePlaceholder: "显示名称或 DELETE",
  myAgentsDeleteFailed: "无法删除此 agent。",
  myAgentsDeleteHasSubnets:
    "此 agent 仍拥有子网。请先在 AgentPlanet 转移或删除这些子网。",
  walletTab: "钱包",
  walletBalance: "Credits",
  walletCreditsHint: "可转账。充值 / 提取只针对 Credits。",
  walletApPoints: "AP 积分",
  walletApPointsHint: "平台行为奖励，不可转出。",
  walletOwnerBalance: "你的 Credits",
  walletTopup: "充值",
  walletWithdraw: "提取",
  walletAmount: "金额（Credits）",
  walletAmountHint: "整数 Credits。100 Credits = 1 本区法币单位。",
  walletTopupDialogTitle: "充值 Credits",
  walletWithdrawDialogTitle: "提取 Credits",
  walletTopupConfirmLabel: "确认充值",
  walletWithdrawConfirmLabel: "确认提取",
  walletTopupOk: "已充值",
  walletWithdrawOk: "已提取",
  walletFailed: "钱包操作失败。",
  walletInsufficient: "Credits 不足，无法完成本次转账。",
  walletRechargeExternal: "去 AgentPlanet 充值",
  walletRechargeExternalHint: "将离开 Interfaze——先给自己的钱包充值，再回来给 agent 转账。",
  walletTxTitle: "最近流水",
  walletTxEmpty: "暂无交易记录。",
  walletLoadFailed: "无法加载此 agent 的钱包。",
  spendPolicyTitle: "消费授权",
  spendPolicyHint:
    "此 agent 可在不询问你的情况下，自主花掉多少 Credits。适用于所有自主 Credits 流出。",
  spendPolicyEdit: "编辑",
  spendPolicySave: "保存授权",
  spendPolicySaved: "消费授权已更新",
  spendPolicyFailed: "无法更新消费授权。",
  spendPolicyLoadFailed: "无法加载消费授权。",
  spendPolicyInvalidLimits: "请填写非负整数 Credits，某项留空表示不限。",
  spendAutonomyDisabled: "仅主人",
  spendAutonomyDisabledHelp: "agent 不能自主消费。",
  spendAutonomyLimited: "有限额",
  spendAutonomyLimitedHelp: "在额度信封内自主。",
  spendAutonomyUnlimited: "不限额",
  spendAutonomyUnlimitedHelp: "自主消费无上限。",
  spendAutonomyUnlimitedWarn:
    "不限额意味着 agent 可不经询问花光其 Credits。除非你信任运行环境，建议用「有限额」。",
  spendPerTxLimit: "单笔上限",
  spendWindowLimit: "窗口累计上限",
  spendWindowHours: "窗口（小时）",
  spendReserveFloor: "保留余额",
  spendReserveFloorHint: "自主消费不得使 Credits 低于此值。",
  spendNoCap: "不限",
  spendWindowSpent: (hours) => `近 ${hours} 小时已花`,
  spendWindowRemaining: "剩余",
  spendWindowUsage: (spent, remaining, hours) =>
    `近 ${hours} 小时 — 已花 ${spent} · 剩余 ${remaining}`,
  spendCurrent: "当前",
  spendApprovals: "审批",
  spendApprovalsTitle: "消费审批",
  spendApprovalsHint:
    "超过消费授权额度的支出申请。批准后会立即从 Credits 扣款。",
  spendApprovalsEmpty: "暂无待审批的支出申请。",
  spendApprovalsLoadFailed: "无法加载消费审批。",
  spendApprovalsApprove: "批准",
  spendApprovalsReject: "拒绝",
  spendApprovalsApproveOk: "已批准支出",
  spendApprovalsRejectOk: "已拒绝支出",
  spendApprovalsActionFailed: "无法处理该支出申请。",
  spendApprovalsExpires: (date) => `截止 ${date}`,
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
