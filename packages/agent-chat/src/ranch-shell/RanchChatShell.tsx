"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChatGatewayError, createGatewayClient } from "../gateway";
import type {
  AgentDirectoryItem,
  ChatMessage,
  ChatSummary,
  RanchChatAccount,
  RanchChatShellProps,
} from "../types";
import { connectChatSocket, type ChatSocket } from "../ws";
import { NewChatPicker } from "./NewChatPicker";
import { CONNECT_PROMPTS, copyText } from "./connectPrompt";
import {
  RANCH_LOCALE_OPTIONS,
  ranchMessages,
  readStoredRanchLocale,
  resolveRanchLocale,
  writeStoredRanchLocale,
  type RanchLocale,
  type RanchMessages,
} from "./i18n";
import { btnGhost, btnIcon, btnPrimary, colors, inputStyle, shellRoot } from "./styles";

function formatRelativeTime(iso: string | null | undefined, t: RanchMessages): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minsAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return t.daysAgo(days);
  return date.toLocaleDateString();
}

function chatTitle(c: ChatSummary): string {
  return (c.title && c.title.trim()) || c.agent_id || c.chat_id.slice(0, 8);
}

/** Short agent id for conversation header subtitle (list stays name-only). */
function shortAgentId(agentId?: string | null): string {
  if (!agentId) return "";
  const s = agentId.replace(/^acn:/i, "").trim();
  if (!s) return "";
  return s.length > 8 ? s.slice(0, 8) : s;
}

/** Status colors for avatar corner dots (direct chats only). */
function agentStatusDotColor(status?: string | null): string | null {
  if (!status) return null;
  switch (status.toLowerCase()) {
    case "active":
      return "#22c55e"; // green-500
    case "busy":
      return "#eab308"; // yellow-500
    case "idle":
    case "offline":
      return "#64748b"; // slate-500 — visible "not listening"
    default:
      return null;
  }
}

function isAgentOffline(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "offline" || s === "idle";
}

function agentStatusTitle(status: string | null | undefined, t: RanchMessages): string | undefined {
  if (!status) return undefined;
  switch (status.toLowerCase()) {
    case "active":
      return t.online;
    case "busy":
      return t.busy;
    case "idle":
    case "offline":
      return t.offline;
    default:
      return undefined;
  }
}

function isGroupChat(c: ChatSummary): boolean {
  return c.type === "group" || c.type === "GROUP";
}

/** Legacy system bubbles from before delivery icons — hide in the transcript. */
function isLegacyDeliveryAckBubble(m: ChatMessage): boolean {
  if (m.sender_type !== "system") return false;
  const c = (m.content || "").toLowerCase();
  return (
    c.includes("delivered to agent") ||
    c.includes("waiting for a reply") ||
    c.includes("mode b / local-receiver") ||
    c.includes("queued in acn inbox")
  );
}

function parseMessageMetadata(raw: unknown): ChatMessage["metadata"] {
  if (!raw || typeof raw !== "object") return null;
  return raw as ChatMessage["metadata"];
}

function DeliveryStatusIcon({
  delivery,
  t,
}: {
  delivery?: string | null;
  t: RanchMessages;
}) {
  if (!delivery) return null;
  const common: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    height: 14,
  };
  const stroke =
    delivery === "pending" || delivery === "sent" ? colors.muted : "#93c5fd";
  const title =
    delivery === "pending"
      ? t.sending
      : delivery === "sent"
        ? t.sent
        : delivery === "queued"
          ? t.queuedOffline
          : delivery === "failed"
            ? t.deliveryFailed
            : t.delivered;

  if (delivery === "pending") {
    return (
      <span title={title} aria-label={title} style={{ ...common, color: stroke }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
          <path d="M8 4.5V8l2.2 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (delivery === "sent") {
    // Single check — accepted by Gateway, not yet acked by agent transport.
    return (
      <span title={title} aria-label={title} style={{ ...common, color: stroke }}>
        <svg width="12" height="12" viewBox="0 0 16 14" fill="none" aria-hidden>
          <path
            d="M2 7.2 5.6 10.5 13.5 2.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  // Queued / failed: plain label — icons (esp. envelope) read as email and confuse users.
  if (delivery === "queued" || delivery === "failed") {
    return (
      <span
        aria-label={title}
        style={{
          fontSize: 11,
          lineHeight: 1.2,
          color: delivery === "failed" ? colors.danger : colors.muted,
        }}
      >
        {title}
      </span>
    );
  }
  // delivered — double check (ACN transport ACK)
  return (
    <span title={title} aria-label={title} style={{ ...common, color: stroke }}>
      <svg width="14" height="12" viewBox="0 0 18 14" fill="none" aria-hidden>
        <path
          d="M1.5 7.5 4.8 10.5 10.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 10.5 8.2 11.6 14.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    </span>
  );
}

/** Typing indicator in the agent-bubble slot (Mode B writeback in flight). */
function AgentReplyPendingBubble({ t }: { t: RanchMessages }) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "85%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "flex-start",
      }}
      aria-live="polite"
      aria-label={t.waitingReply}
    >
      <div
        style={{
          background: colors.agentBubble,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.5,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          color: colors.muted,
        }}
      >
        <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 12 }} aria-hidden>
          <span className="ranch-reply-dot" style={{ animationDelay: "0ms" }} />
          <span className="ranch-reply-dot" style={{ animationDelay: "160ms" }} />
          <span className="ranch-reply-dot" style={{ animationDelay: "320ms" }} />
        </span>
        <span style={{ fontSize: 12 }}>{t.waitingReply}</span>
      </div>
    </div>
  );
}

type ReplyTimeoutReason = "offline" | "timeout";

/** Explicit error in agent slot + retry (not a silent blank / endless spinner). */
function AgentReplyTimeoutBubble({
  reason,
  onRetry,
  t,
}: {
  reason: ReplyTimeoutReason;
  onRetry: () => void;
  t: RanchMessages;
}) {
  const message = reason === "offline" ? t.timeoutOffline : t.timeoutGeneric;
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "85%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start",
      }}
      aria-live="assertive"
      aria-label={message}
    >
      <div
        style={{
          background: colors.agentBubble,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          color: colors.danger,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4.2M8 11.2h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{message}</span>
        </span>
        <button
          type="button"
          onClick={onRetry}
          style={{
            alignSelf: "flex-start",
            margin: 0,
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${colors.danger}`,
            background: "transparent",
            color: colors.danger,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {t.retry}
        </button>
      </div>
    </div>
  );
}

function NoAgentsEmpty({
  connectGuideUrl,
  locale,
  onNewChat,
  t,
}: {
  connectGuideUrl?: string;
  locale: RanchLocale;
  onNewChat: () => void;
  t: RanchMessages;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ textAlign: "center", padding: "28px 20px", color: colors.muted }}>
      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: colors.text }}>
        {t.noAgentsTitle}
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 12, lineHeight: 1.55 }}>{t.noAgentsBody}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          style={btnPrimary}
          onClick={() => {
            void copyText(CONNECT_PROMPTS[locale]).then((ok) => {
              if (!ok) return;
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? t.promptCopied : t.copyPromptForAgent}
        </button>
        {connectGuideUrl ? (
          <a
            href={connectGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colors.muted, fontSize: 12 }}
          >
            {t.viewConnectGuide}
          </a>
        ) : null}
        <button type="button" style={btnGhost} onClick={onNewChat}>
          {t.pasteAgentId}
        </button>
      </div>
    </div>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Group delivery requires mentions; shell defaults to all agents (implicit @all). */
function resolveGroupMentions(text: string, agentIds: string[]): string[] {
  if (agentIds.length === 0) return [];
  if (/(^|\s)@all\b/i.test(text)) return [...agentIds];
  const hit = agentIds.filter((id) =>
    new RegExp(`(^|\\s)@${escapeRegExp(id)}\\b`, "i").test(text),
  );
  return hit.length > 0 ? hit : [...agentIds];
}

/** Prefer Gateway/ACN display name; fall back to host directory, then short id. */
function resolveParticipantLabels(
  agents: Array<{ participant_id: string; name?: string | null }>,
  directoryAgents: AgentDirectoryItem[],
): Record<string, string> {
  const dirNames: Record<string, string> = {};
  for (const a of directoryAgents) {
    const label = (a.name || "").trim();
    if (label) dirNames[a.agent_id] = label;
  }
  const names: Record<string, string> = {};
  for (const p of agents) {
    const fromApi = (p.name || "").trim();
    const looksLikeId = !fromApi || fromApi === p.participant_id;
    names[p.participant_id] =
      (!looksLikeId ? fromApi : null) ||
      dirNames[p.participant_id] ||
      fromApi ||
      shortAgentId(p.participant_id) ||
      p.participant_id;
  }
  return names;
}

/**
 * Ranch-ported chat chrome: list → conversation → new-chat picker.
 * Transport: Chat Gateway only (not ranch /api/chat AI SDK).
 */
/** Diagonal arrows outward — open / fullscreen (lucide Maximize2). */
function IconExpand() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Diagonal arrows inward — collapse / side (lucide Minimize2). */
function IconCollapse() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Simple left-rail panel (no chevron). Same glyph for collapse/expand. */
function IconSidebar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M9 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Ranch SystemHeader-style locale control: compact round chip + menu (scales). */
function LanguageSwitcher({
  locale,
  onChange,
  t,
}: {
  locale: RanchLocale;
  onChange: (next: RanchLocale) => void;
  t: RanchMessages;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        style={{
          ...btnIcon,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: colors.muted,
          lineHeight: 1,
        }}
        aria-label={t.language}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t.language}
        onClick={() => setOpen((v) => !v)}
      >
        {RANCH_LOCALE_OPTIONS.find((o) => o.code === locale)?.label ?? locale}
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t.language}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 30,
            margin: 0,
            padding: 4,
            listStyle: "none",
            minWidth: 56,
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
          }}
        >
          {RANCH_LOCALE_OPTIONS.map((opt) => {
            const active = opt.code === locale;
            return (
              <li key={opt.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.code);
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    margin: 0,
                    padding: "6px 10px",
                    border: "none",
                    borderRadius: 6,
                    background: active ? colors.accentSoft : "transparent",
                    color: active ? colors.text : colors.muted,
                    fontSize: 12,
                    fontWeight: 650,
                    letterSpacing: "0.04em",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function AccountFooter({
  account,
  onLogout,
  t,
}: {
  account: RanchChatAccount;
  onLogout?: () => void;
  t: RanchMessages;
}) {
  const label = (account.name || account.email || t.account).trim();
  const initial = label.slice(0, 1).toUpperCase() || "?";
  return (
    <div
      style={{
        borderTop: `1px solid ${colors.border}`,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
        background: colors.panel,
      }}
    >
      {account.picture ? (
        <img
          src={account.picture}
          alt=""
          width={32}
          height={32}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            objectFit: "cover",
            flexShrink: 0,
            background: colors.border,
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "linear-gradient(135deg,#475569,#1e293b)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        {account.name && account.email ? (
          <div
            style={{
              fontSize: 11,
              color: colors.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {account.email}
          </div>
        ) : null}
      </div>
      {onLogout ? (
        <button
          type="button"
          onClick={onLogout}
          style={{
            ...btnGhost,
            fontSize: 12,
            padding: "4px 8px",
            flexShrink: 0,
          }}
          aria-label={t.logOut}
        >
          {t.logOut}
        </button>
      ) : null}
    </div>
  );
}

export function RanchChatShell(props: RanchChatShellProps) {
  const {
    getAccessToken,
    gatewayBaseUrl,
    directoryAgents = [],
    title = "Chats",
    mode: modeProp = "side",
    open: openProp,
    onOpenChange,
    onClose,
    allowGroupChat = true,
    account,
    onLogout,
    connectGuideUrl,
    locale: localeProp,
    onLocaleChange,
  } = props;

  const [uiLocale, setUiLocale] = useState<RanchLocale>(() => resolveRanchLocale(localeProp));
  const t = useMemo(() => ranchMessages(uiLocale), [uiLocale]);

  useEffect(() => {
    const stored = readStoredRanchLocale();
    if (stored) {
      setUiLocale(stored);
      return;
    }
    if (localeProp) {
      setUiLocale(resolveRanchLocale(localeProp));
      return;
    }
    if (typeof navigator !== "undefined") {
      setUiLocale(resolveRanchLocale(navigator.language));
    }
  }, []);

  useEffect(() => {
    if (localeProp == null) return;
    setUiLocale(resolveRanchLocale(localeProp));
  }, [localeProp]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = uiLocale;
    }
  }, [uiLocale]);

  const setLocale = useCallback(
    (next: RanchLocale) => {
      setUiLocale(next);
      writeStoredRanchLocale(next);
      onLocaleChange?.(next);
    },
    [onLocaleChange],
  );

  const [internalOpen, setInternalOpen] = useState(true);
  const open = openProp ?? internalOpen;
  const [mode, setMode] = useState(modeProp);
  /** Fullscreen only: hide/show the left chat list. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setInternalOpen(next);
      if (!next) onClose?.();
    },
    [onClose, onOpenChange, openProp],
  );

  useEffect(() => {
    setMode(modeProp);
    if (modeProp !== "full") setSidebarCollapsed(false);
  }, [modeProp]);

  const showSidebar = mode !== "full" || !sidebarCollapsed;

  const client = useMemo(
    () => createGatewayClient(gatewayBaseUrl, getAccessToken),
    [gatewayBaseUrl, getAccessToken],
  );

  const [view, setView] = useState<"list" | "conversation">("list");
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [active, setActive] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** agent_id → display name (group chats). */
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  /** Agent-slot: typing → timeout+retry (not endless spinner). */
  const [replySlot, setReplySlot] = useState<null | {
    chatId: string;
    phase: "pending" | "timeout";
    reason?: ReplyTimeoutReason;
  }>(null);
  const replySlotChatIdRef = useRef<string | null>(null);
  const awaitingSinceRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  /** Bumps on each conversation open / chat switch to ignore stale listMessages. */
  const loadSeqRef = useRef(0);
  /** Cancels in-flight post-send poll when chat switches or a newer send starts. */
  const replyPollGenRef = useRef(0);
  /** Active agent participant ids for group mention delivery. */
  const agentIdsRef = useRef<string[]>([]);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = active?.chat_id ?? null;

  const clearReplySlot = useCallback((chatId?: string) => {
    setReplySlot((cur) => {
      if (chatId != null && cur && cur.chatId !== chatId) return cur;
      replySlotChatIdRef.current = null;
      return null;
    });
  }, []);

  const beginAwaitingReply = useCallback((chatId: string) => {
    awaitingSinceRef.current = Date.now();
    replySlotChatIdRef.current = chatId;
    setReplySlot({ chatId, phase: "pending" });
  }, []);

  const markReplyTimeout = useCallback((chatId: string, reason: ReplyTimeoutReason = "timeout") => {
    if (replySlotChatIdRef.current !== chatId) return;
    setReplySlot({ chatId, phase: "timeout", reason });
  }, []);

  const noteAgentActivity = useCallback(
    (chatId: string, msgs: ChatMessage[]) => {
      if (replySlotChatIdRef.current !== chatId) return;
      const since = awaitingSinceRef.current;
      const hasReply = msgs.some(
        (m) =>
          m.sender_type === "agent" &&
          Date.parse(m.created_at) >= since - 2000,
      );
      if (hasReply) {
        clearReplySlot(chatId);
        return;
      }
      // Transport delivery failed / queued offline → stop spinning with a clear reason.
      const recentUser = [...msgs].reverse().find((m) => m.sender_type === "user");
      if (!recentUser || Date.parse(recentUser.created_at) < since - 2000) return;
      const delivery = recentUser.metadata?.delivery;
      if (delivery === "failed") {
        clearReplySlot(chatId);
        return;
      }
      if (delivery === "queued") {
        markReplyTimeout(chatId, "offline");
      }
    },
    [clearReplySlot, markReplyTimeout],
  );

  const refreshChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const list = await client.listChats();
      setChats(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chats");
    } finally {
      setLoadingChats(false);
    }
  }, [client]);

  const searchDiscover = useCallback(
    async (q: string): Promise<AgentDirectoryItem[]> => {
      const hits = await client.searchAgents(q, 20);
      return hits.map((h) => ({
        agent_id: h.agent_id,
        name: h.name,
        description: h.description,
        group: "recommended" as const,
      }));
    },
    [client],
  );

  // Keep presence dots fresh while a conversation is open.
  useEffect(() => {
    if (!open || !active) return;
    const tick = window.setInterval(() => {
      void client.listChats().then((list) => {
        setChats(list);
        const next = list.find((c) => c.chat_id === active.chat_id);
        if (next) setActive(next);
      });
    }, 20000);
    return () => window.clearInterval(tick);
  }, [open, active?.chat_id, client]);

  const reloadMessages = useCallback(
    async (chatId: string, seq?: number) => {
      const msgs = await client.listMessages(chatId);
      if (seq != null && seq !== loadSeqRef.current) return;
      if (activeChatIdRef.current !== chatId) return;
      setMessages(msgs);
    },
    [client],
  );

  useEffect(() => {
    if (!open) return;
    void refreshChats();
    (async () => {
      try {
        const h = await client.health();
        setHealthOk(h.ok);
      } catch {
        setHealthOk(false);
      }
    })();
  }, [open, client, refreshChats]);

  /** Ensure host "mine" ACN agents always have a direct chat row in the list. */
  const ensuredMineKeyRef = useRef("");
  useEffect(() => {
    if (!open) return;
    const mine = directoryAgents.filter((a) => a.group === "mine" && a.agent_id.trim());
    if (mine.length === 0) return;
    const key = mine
      .map((a) => a.agent_id)
      .sort()
      .join("|");
    if (ensuredMineKeyRef.current === key) return;

    let cancelled = false;
    (async () => {
      try {
        const list = await client.listChats();
        if (cancelled) return;
        const have = new Set(
          list.map((c) => (c.agent_id || "").trim()).filter(Boolean),
        );
        const missing = mine.filter((a) => !have.has(a.agent_id));
        for (const a of missing) {
          if (cancelled) return;
          await client.createOrGetDirectChat(a.agent_id);
        }
        if (cancelled) return;
        ensuredMineKeyRef.current = key;
        if (missing.length > 0) await refreshChats();
      } catch {
        /* best-effort — picker still works */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, directoryAgents, client, refreshChats]);

  const openConversation = useCallback(
    async (chat: ChatSummary) => {
      const seq = ++loadSeqRef.current;
      activeChatIdRef.current = chat.chat_id;
      setActive(chat);
      setView("conversation");
      setError(null);
      setMessages([]);
      setAgentNames({});
      setDraft("");
      clearReplySlot();
      agentIdsRef.current = [];
      try {
        const [msgs, participants] = await Promise.all([
          client.listMessages(chat.chat_id),
          isGroupChat(chat)
            ? client.listParticipants(chat.chat_id).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (seq !== loadSeqRef.current) return;
        setMessages(msgs);
        const agents = participants.filter(
          (p) => p.participant_type === "agent" && p.is_active !== false,
        );
        agentIdsRef.current = agents.map((p) => p.participant_id);
        setAgentNames(resolveParticipantLabels(agents, directoryAgents));
      } catch (e) {
        if (seq !== loadSeqRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load messages");
      }
    },
    [client, clearReplySlot, directoryAgents],
  );

  useEffect(() => {
    if (!open || !active?.chat_id || view !== "conversation") {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }
    let cancelled = false;
    const chatId = active.chat_id;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      const sock = connectChatSocket({
        gatewayBaseUrl,
        token,
        onEvent: (ev) => {
          if (ev.chat_id && ev.chat_id !== chatId) return;
          if (ev.type === "message.new" && ev.data) {
            const d = ev.data;
            const messageId = d.message_id != null ? String(d.message_id) : "";
            if (!messageId) return;
            const m: ChatMessage = {
              message_id: messageId,
              chat_id: chatId,
              sender_type: String(d.sender_type ?? "agent"),
              sender_id: String(d.sender_id ?? ""),
              content: typeof d.content === "string" ? d.content : null,
              created_at:
                typeof d.created_at === "string" ? d.created_at : new Date().toISOString(),
              metadata: parseMessageMetadata(d.metadata),
            };
            setMessages((prev) => {
              const next = prev.some((x) => x.message_id === m.message_id) ? prev : [...prev, m];
              if (m.sender_type === "agent") {
                queueMicrotask(() => noteAgentActivity(chatId, next));
              }
              return next;
            });
            void refreshChats();
          }
          // Streaming chunks may omit final content on message.new; resync on end.
          // Also used when delivery metadata updates (sent → delivered).
          if (ev.type === "message.stream_end") {
            void (async () => {
              const msgs = await client.listMessages(chatId);
              if (activeChatIdRef.current !== chatId) return;
              setMessages(msgs);
              noteAgentActivity(chatId, msgs);
              void refreshChats();
            })();
          }
        },
      });
      sock.subscribe(chatId);
      socketRef.current = sock;
    })();
    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [
    open,
    active?.chat_id,
    view,
    gatewayBaseUrl,
    getAccessToken,
    refreshChats,
    client,
    noteAgentActivity,
  ]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, view, replySlot]);

  const startDirect = async (agentId: string) => {
    setBusy(true);
    setError(null);
    try {
      const c = await client.createOrGetDirectChat(agentId);
      setShowPicker(false);
      await refreshChats();
      await openConversation(c);
    } catch (e) {
      setError(
        e instanceof ChatGatewayError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to start chat",
      );
    } finally {
      setBusy(false);
    }
  };

  const startGroup = async (groupTitle: string, agentIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const c = await client.createGroupChat(groupTitle, agentIds);
      setShowPicker(false);
      await refreshChats();
      await openConversation(c);
    } catch (e) {
      setError(
        e instanceof ChatGatewayError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to create group",
      );
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !active) return;
    const chatId = active.chat_id;
    const group = isGroupChat(active);
    const seq = loadSeqRef.current;
    const pollGen = ++replyPollGenRef.current;
    setBusy(true);
    setError(null);
    try {
      if (group && agentIdsRef.current.length === 0) {
        const participants = await client.listParticipants(chatId);
        if (seq !== loadSeqRef.current) return;
        const agents = participants.filter(
          (p) => p.participant_type === "agent" && p.is_active !== false,
        );
        agentIdsRef.current = agents.map((p) => p.participant_id);
        setAgentNames(resolveParticipantLabels(agents, directoryAgents));
      }
      const mentions = group ? resolveGroupMentions(text, agentIdsRef.current) : undefined;
      beginAwaitingReply(chatId);
      const sentWhileOffline = !group && isAgentOffline(active?.agent_status);
      await client.sendMessage(chatId, text, mentions);
      setDraft("");
      await reloadMessages(chatId, seq);
      await refreshChats();
      // Mode B writeback is async (~5–30s). WS message.new can be missed; poll DB.
      void (async () => {
        const baseline = awaitingSinceRef.current;
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          if (replyPollGenRef.current !== pollGen) return;
          if (activeChatIdRef.current !== chatId) return;
          if (seq !== loadSeqRef.current) return;
          try {
            const msgs = await client.listMessages(chatId);
            if (replyPollGenRef.current !== pollGen) return;
            if (activeChatIdRef.current !== chatId) return;
            setMessages(msgs);
            const hasNewAgent = msgs.some(
              (m) =>
                m.sender_type === "agent" &&
                Date.parse(m.created_at) >= baseline - 2000,
            );
            if (hasNewAgent) {
              clearReplySlot(chatId);
              void refreshChats();
              return;
            }
            noteAgentActivity(chatId, msgs);
            // Already offline at send: don't spin the full window before explaining.
            if (sentWhileOffline && i >= 2) {
              markReplyTimeout(chatId, "offline");
              return;
            }
          } catch {
            /* ignore transient poll errors */
          }
        }
        // Past the wait window → timeout + retry (not a silent blank).
        markReplyTimeout(chatId, sentWhileOffline ? "offline" : "timeout");
      })();
    } catch (e) {
      clearReplySlot(chatId);
      setError(
        e instanceof ChatGatewayError
          ? e.code === "agent_unreachable"
            ? t.unreachable
            : e.message
          : t.sendFailed,
      );
      try {
        await reloadMessages(chatId, seq);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  };

  const retryLastUserMessage = () => {
    if (!active) return;
    const lastUser = [...messages].reverse().find((m) => m.sender_type === "user");
    const text = (lastUser?.content || "").trim();
    if (!text) return;
    setDraft(text);
    // Re-send on next tick so draft is set; call send path directly.
    void (async () => {
      const chatId = active.chat_id;
      const group = isGroupChat(active);
      const seq = loadSeqRef.current;
      const pollGen = ++replyPollGenRef.current;
      setBusy(true);
      setError(null);
      try {
        const mentions = group ? resolveGroupMentions(text, agentIdsRef.current) : undefined;
        beginAwaitingReply(chatId);
        await client.sendMessage(chatId, text, mentions);
        setDraft("");
        await reloadMessages(chatId, seq);
        await refreshChats();
        void (async () => {
          const baseline = awaitingSinceRef.current;
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            if (replyPollGenRef.current !== pollGen) return;
            if (activeChatIdRef.current !== chatId) return;
            if (seq !== loadSeqRef.current) return;
            try {
              const msgs = await client.listMessages(chatId);
              if (replyPollGenRef.current !== pollGen) return;
              if (activeChatIdRef.current !== chatId) return;
              setMessages(msgs);
              const hasNewAgent = msgs.some(
                (m) =>
                  m.sender_type === "agent" &&
                  Date.parse(m.created_at) >= baseline - 2000,
              );
              if (hasNewAgent) {
                clearReplySlot(chatId);
                void refreshChats();
                return;
              }
              noteAgentActivity(chatId, msgs);
            } catch {
              /* ignore */
            }
          }
          markReplyTimeout(chatId);
        })();
      } catch (e) {
        clearReplySlot(chatId);
        setError(
          e instanceof ChatGatewayError
            ? e.code === "agent_unreachable"
              ? t.unreachable
              : e.message
            : t.sendFailed,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  if (!open) return null;

  const filtered = chats.filter((c) => {
    // Legacy platform sys:* assistants are retired from Interfaze surfaces.
    if ((c.agent_id || "").startsWith("sys:")) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return chatTitle(c).toLowerCase().includes(q) || (c.agent_id ?? "").toLowerCase().includes(q);
  });

  const showAgentReplyPending =
    replySlot?.phase === "pending" && replySlot.chatId === active?.chat_id;
  const showAgentReplyTimeout =
    replySlot?.phase === "timeout" && replySlot.chatId === active?.chat_id;
  const replyTimeoutReason: ReplyTimeoutReason = replySlot?.reason ?? "timeout";
  const mineAgents = directoryAgents.filter((a) => a.group === "mine" && a.agent_id.trim());
  const hasMineAgents = mineAgents.length > 0;
  const activeOffline = active && !isGroupChat(active) && isAgentOffline(active.agent_status);

  return (
    <div style={shellRoot(mode)} data-ranch-chat-shell data-mode={mode}>
      <style>{`
        @keyframes ranch-reply-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
        .ranch-reply-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
          animation: ranch-reply-bounce 1.2s ease-in-out infinite;
        }
      `}</style>
      <div
        style={{
          width: mode === "full" ? 360 : "100%",
          maxWidth: mode === "full" ? 360 : undefined,
          borderRight: mode === "full" ? `1px solid ${colors.border}` : undefined,
          display: showSidebar && (view === "list" || mode === "full") ? "flex" : "none",
          flexDirection: "column",
          minWidth: 0,
          height: "100%",
          background: colors.panel,
          position: "relative",
        }}
      >
        <div style={listHeader}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden>💬</span> {title}
          </h2>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <LanguageSwitcher locale={uiLocale} onChange={setLocale} t={t} />
            {mode === "side" ? (
              <button
                type="button"
                style={btnIcon}
                onClick={() => setMode("full")}
                aria-label={t.expand}
                title={t.expand}
              >
                <IconExpand />
              </button>
            ) : (
              <button
                type="button"
                style={btnIcon}
                onClick={() => setMode("side")}
                aria-label={t.collapse}
                title={t.collapse}
              >
                <IconCollapse />
              </button>
            )}
            {mode === "full" ? (
              <button
                type="button"
                style={btnIcon}
                onClick={() => setSidebarCollapsed(true)}
                aria-label={t.collapseSidebar}
                title={t.collapseSidebar}
              >
                <IconSidebar />
              </button>
            ) : (
              <button
                type="button"
                style={btnIcon}
                onClick={() => setOpen(false)}
                aria-label={t.close}
                title={t.close}
              >
                <IconClose />
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 12, borderBottom: `1px solid ${colors.border}`, display: "flex", gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchChats}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" style={btnPrimary} onClick={() => setShowPicker(true)}>
            + {t.newChat}
          </button>
        </div>

        {healthOk === false && (
          <div style={{ padding: "8px 12px", color: colors.danger, fontSize: 12 }}>
            {t.gatewayUnavailable}
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {loadingChats ? (
            <p style={{ color: colors.muted, textAlign: "center", padding: 24 }}>{t.loading}</p>
          ) : filtered.length === 0 ? (
            hasMineAgents ? (
              <div style={{ textAlign: "center", padding: 32, color: colors.muted }}>
                <p style={{ margin: "0 0 12px" }}>{t.noChatsYet}</p>
                <button type="button" style={btnPrimary} onClick={() => setShowPicker(true)}>
                  {t.startChat}
                </button>
              </div>
            ) : (
              <NoAgentsEmpty
                connectGuideUrl={connectGuideUrl}
                locale={uiLocale}
                onNewChat={() => setShowPicker(true)}
                t={t}
              />
            )
          ) : (
            filtered.map((c) => {
              const selected = active?.chat_id === c.chat_id;
              const title = chatTitle(c);
              const preview =
                c.last_message_content || (isGroupChat(c) ? t.groupChat : t.noMessagesYet);
              const dot = !isGroupChat(c) ? agentStatusDotColor(c.agent_status) : null;
              return (
                <button
                  key={c.chat_id}
                  type="button"
                  onClick={() => void openConversation(c)}
                  title={
                    !isGroupChat(c)
                      ? [c.agent_id, agentStatusTitle(c.agent_status, t)].filter(Boolean).join(" · ") ||
                        undefined
                      : undefined
                  }
                  style={{
                    ...listItem,
                    background: selected ? colors.accentSoft : "transparent",
                  }}
                >
                  <span style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: c.type === "group" ? 10 : 999,
                        background: "linear-gradient(135deg,#334155,#1e293b)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                      }}
                    >
                      {title.slice(0, 1).toUpperCase()}
                    </span>
                    {dot ? (
                      <span
                        aria-hidden
                        title={agentStatusTitle(c.agent_status, t)}
                        style={{
                          position: "absolute",
                          right: -1,
                          bottom: -1,
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: dot,
                          border: `2px solid ${colors.panel}`,
                        }}
                      />
                    ) : null}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title}
                      </span>
                      <span style={{ fontSize: 10, color: colors.muted, flexShrink: 0 }}>
                        {formatRelativeTime(c.last_message_at, t)}
                      </span>
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: colors.muted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {preview}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {account ? <AccountFooter account={account} onLogout={onLogout} t={t} /> : null}

        {showPicker && (
          <NewChatPicker
            directoryAgents={directoryAgents}
            allowGroupChat={allowGroupChat}
            busy={busy}
            connectGuideUrl={connectGuideUrl}
            locale={uiLocale}
            messages={t}
            onSearchDiscover={searchDiscover}
            onClose={() => setShowPicker(false)}
            onOpenDirect={(id) => void startDirect(id)}
            onCreateGroup={(titleText, ids) => void startGroup(titleText, ids)}
          />
        )}
      </div>

      {(view === "conversation" || mode === "full") && (
        <div
          style={{
            flex: 1,
            // full: always show right pane (empty state when no selection)
            display: mode === "full" || view === "conversation" ? "flex" : "none",
            flexDirection: "column",
            minWidth: 0,
            height: "100%",
            background: colors.bg,
            position: "relative",
          }}
        >
          {!active ? (
            <>
              {mode === "full" && sidebarCollapsed ? (
                <button
                  type="button"
                  style={{
                    ...btnIcon,
                    position: "absolute",
                    top: 14,
                    left: 14,
                    zIndex: 5,
                  }}
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label={t.expandSidebar}
                  title={t.expandSidebar}
                >
                  <IconSidebar />
                </button>
              ) : null}
              {hasMineAgents ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.muted,
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <p style={{ margin: 0 }}>{t.selectOrStart}</p>
                  <button type="button" style={btnPrimary} onClick={() => setShowPicker(true)}>
                    {t.startChat}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <NoAgentsEmpty
                    connectGuideUrl={connectGuideUrl}
                    locale={uiLocale}
                    onNewChat={() => setShowPicker(true)}
                    t={t}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div style={listHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {mode === "side" && (
                    <button
                      type="button"
                      style={btnGhost}
                      onClick={() => {
                        setView("list");
                        setActive(null);
                      }}
                    >
                      ←
                    </button>
                  )}
                  {mode === "full" && sidebarCollapsed ? (
                    <button
                      type="button"
                      style={btnIcon}
                      onClick={() => setSidebarCollapsed(false)}
                      aria-label={t.expandSidebar}
                      title={t.expandSidebar}
                    >
                      <IconSidebar />
                    </button>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: isGroupChat(active) ? 8 : 999,
                          background: "linear-gradient(135deg,#334155,#1e293b)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {chatTitle(active).slice(0, 1).toUpperCase()}
                      </span>
                      {!isGroupChat(active) && agentStatusDotColor(active.agent_status) ? (
                        <span
                          aria-hidden
                          title={agentStatusTitle(active.agent_status, t)}
                          style={{
                            position: "absolute",
                            right: -1,
                            bottom: -1,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: agentStatusDotColor(active.agent_status)!,
                            border: `2px solid ${colors.bg}`,
                          }}
                        />
                      ) : null}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          fontSize: 15,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={active.agent_id || undefined}
                      >
                        {chatTitle(active)}
                      </strong>
                      {isGroupChat(active) ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: colors.muted,
                          }}
                        >
                          {t.agentsCount(
                            Object.keys(agentNames).length || active.total_members || 0,
                          )}
                        </span>
                      ) : shortAgentId(active.agent_id) ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: colors.muted,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                          }}
                          title={active.agent_id || undefined}
                        >
                          {shortAgentId(active.agent_id)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {mode === "side" ? (
                  <button
                    type="button"
                    style={btnGhost}
                    onClick={() => {
                      setView("list");
                      setActive(null);
                    }}
                    aria-label={t.close}
                    title={t.close}
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {activeOffline ? (
                <div
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: "#fbbf24",
                    background: "rgba(234,179,8,0.1)",
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  {t.offlineBanner}
                  {connectGuideUrl ? (
                    <>
                      {" "}
                      <a
                        href={connectGuideUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#fcd34d" }}
                      >
                        {t.ownerHowToConnect}
                      </a>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div
                ref={listRef}
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {messages.length === 0 && (
                  <p style={{ color: colors.muted, fontSize: 13, margin: 0 }}>
                    {activeOffline ? t.sayHelloOffline : t.sayHello}
                  </p>
                )}
                {messages.filter((m) => !isLegacyDeliveryAckBubble(m)).map((m) => {
                  const isUser = m.sender_type === "user";
                  const delivery =
                    isUser && typeof m.metadata?.delivery === "string" ? m.metadata.delivery : null;
                  const group = active ? isGroupChat(active) : false;
                  const senderLabel =
                    !isUser && group
                      ? agentNames[m.sender_id]?.trim() ||
                        shortAgentId(m.sender_id) ||
                        m.sender_id
                      : null;
                  return (
                    <div
                      key={m.message_id}
                      style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        alignItems: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      {senderLabel ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: colors.muted,
                            paddingLeft: 4,
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={m.sender_id}
                        >
                          {senderLabel}
                        </span>
                      ) : null}
                      <div
                        style={{
                          background: isUser ? colors.userBubble : colors.agentBubble,
                          borderRadius: 12,
                          padding: "8px 12px",
                          fontSize: 14,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {m.content}
                      </div>
                      {delivery ? (
                        <div style={{ paddingRight: 2, lineHeight: 1 }}>
                          <DeliveryStatusIcon delivery={delivery} t={t} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {showAgentReplyPending ? <AgentReplyPendingBubble t={t} /> : null}
                {showAgentReplyTimeout ? (
                  <AgentReplyTimeoutBubble
                    reason={replyTimeoutReason}
                    onRetry={retryLastUserMessage}
                    t={t}
                  />
                ) : null}
              </div>

              {error && (
                <div style={{ padding: "8px 14px", color: colors.danger, fontSize: 12 }}>{error}</div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  padding: 12,
                  display: "flex",
                  gap: 8,
                }}
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder={healthOk === false ? t.gatewayUnavailable : t.messagePlaceholder}
                  disabled={busy || healthOk === false}
                  style={{ ...inputStyle, resize: "none", flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim() || healthOk === false}
                  style={{ ...btnPrimary, alignSelf: "flex-end" }}
                >
                  {t.send}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {error && view === "list" && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            padding: 10,
            borderRadius: 8,
            background: "rgba(248,113,113,0.12)",
            color: colors.danger,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

const listHeader: CSSProperties = {
  minHeight: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: `1px solid ${colors.border}`,
  flexShrink: 0,
};

const listItem: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: 8,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  color: colors.text,
  marginBottom: 2,
};
