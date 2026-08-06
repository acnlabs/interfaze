"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChatGatewayError, createGatewayClient, type MyAgentSummary } from "../gateway";
import type {
  AgentDirectoryItem,
  ChatMessage,
  ChatSummary,
  RanchChatAccount,
  RanchChatShellProps,
  ThreadSummary,
} from "../types";
import { connectChatSocket, type ChatSocket } from "../ws";
import {
  AgentOwnerSettings,
  deliveryLabel,
  deliveryValueHint,
  FieldHint,
} from "./AgentOwnerSettings";
import { AgentOwnerWallet } from "./AgentOwnerWallet";
import { MyAgentsPanel } from "./MyAgentsPanel";
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

/** Normalize for membership checks (acn:uuid ↔ uuid). */
function agentIdKey(agentId?: string | null): string {
  return (agentId || "").replace(/^acn:/i, "").trim().toLowerCase();
}

function isAgentInGroup(agentId: string, names: Record<string, string>): boolean {
  const key = agentIdKey(agentId);
  if (!key) return false;
  return Object.keys(names).some((id) => agentIdKey(id) === key);
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

/** Latest user outbound transport is queued/failed → treat as offline for the green dot. */
function latestUserDeliveryBroken(msgs: ChatMessage[]): boolean {
  const recentUser = [...msgs].reverse().find((m) => m.sender_type === "user");
  if (!recentUser) return false;
  const d = recentUser.metadata?.delivery;
  return d === "queued" || d === "failed";
}

/** Prefer delivery health over stale ACN "online" for presence dots. */
function presenceForDot(
  acnStatus: string | null | undefined,
  deliveryBroken: boolean,
): string | null | undefined {
  if (deliveryBroken) return "offline";
  return acnStatus;
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
        />
      </svg>
    </span>
  );
}

function deliveryStatusLabel(delivery: string, t: RanchMessages): string {
  if (delivery === "pending") return t.sending;
  if (delivery === "sent") return t.sent;
  if (delivery === "queued") return t.queuedOffline;
  if (delivery === "failed") return t.deliveryFailed;
  return t.delivered;
}

function DeliveryStatusFooter({
  delivery,
  byAgent,
  names,
  t,
}: {
  delivery?: string | null;
  byAgent?: Record<string, string> | null;
  names: Record<string, string>;
  t: RanchMessages;
}) {
  const entries =
    byAgent && typeof byAgent === "object"
      ? Object.entries(byAgent).filter(([, s]) => typeof s === "string" && s)
      : [];

  if (entries.length >= 2) {
    const full = entries
      .map(([id, status]) => {
        const label = names[id]?.trim() || shortAgentId(id) || id;
        return `${label} ${deliveryStatusLabel(status, t)}`;
      })
      .join(" · ");
    return (
      <div
        title={full}
        aria-label={full}
        style={{
          paddingRight: 2,
          fontSize: 11,
          lineHeight: 1.35,
          color: colors.muted,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {entries.map(([id, status], i) => {
          const label = names[id]?.trim() || shortAgentId(id) || id;
          return (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                verticalAlign: "middle",
              }}
            >
              {i > 0 ? <span style={{ margin: "0 4px" }}>·</span> : null}
              <span style={{ color: colors.text }}>{label}</span>
              <DeliveryStatusIcon delivery={status} t={t} />
            </span>
          );
        })}
      </div>
    );
  }

  if (!delivery) return null;
  return (
    <div style={{ paddingRight: 2, lineHeight: 1 }}>
      <DeliveryStatusIcon delivery={delivery} t={t} />
    </div>
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

const STICKY_MENTION_TTL_MS = 15 * 60 * 1000;

type StickyMention = { agentId: string; name: string; setAt: number };

function stickyMentionStorageKey(chatId: string): string {
  return `interfaze:stickyMention:${chatId}`;
}

function readStickyMention(chatId: string): StickyMention | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(stickyMentionStorageKey(chatId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StickyMention;
    if (
      !parsed ||
      typeof parsed.agentId !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.setAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.setAt > STICKY_MENTION_TTL_MS) {
      sessionStorage.removeItem(stickyMentionStorageKey(chatId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStickyMention(chatId: string, sticky: StickyMention | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = stickyMentionStorageKey(chatId);
    if (!sticky) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(sticky));
  } catch {
    /* ignore */
  }
}

/** Explicit @ / @all only — no silent @all fallback. */
function resolveGroupMentions(
  text: string,
  agentIds: string[],
  names: Record<string, string> = {},
): string[] {
  if (agentIds.length === 0) return [];
  if (/(^|\s)@all\b/i.test(text)) return [...agentIds];
  const hit = new Set<string>();
  for (const id of agentIds) {
    if (new RegExp(`(^|\\s)@${escapeRegExp(id)}\\b`, "i").test(text)) hit.add(id);
    const label = (names[id] || "").trim();
    if (label && new RegExp(`(^|\\s)@${escapeRegExp(label)}\\b`, "i").test(text)) {
      hit.add(id);
    }
  }
  return [...hit];
}

function resolveStickyMentions(
  text: string,
  agentIds: string[],
  names: Record<string, string>,
  sticky: StickyMention | null,
): { mentions: string[]; usedSticky: boolean } {
  const explicit = resolveGroupMentions(text, agentIds, names);
  if (explicit.length > 0) return { mentions: explicit, usedSticky: false };
  if (
    sticky &&
    Date.now() - sticky.setAt <= STICKY_MENTION_TTL_MS &&
    agentIds.includes(sticky.agentId)
  ) {
    return { mentions: [sticky.agentId], usedSticky: true };
  }
  return { mentions: [], usedSticky: false };
}

/** Trailing `@query` for mention autocomplete (ranch-style). */
function trailingMentionQuery(text: string): string | null {
  const m = text.match(/(?:^|\s)@([^\s@]*)$/);
  return m ? m[1] : null;
}

type SlashCmdId = "topic" | "agent" | "members" | "info";

/** Insert 「显示名」 reference — not a delivery @mention. */
function formatAgentRef(displayName: string): string {
  const name = displayName.trim() || "agent";
  return `「${name}」`;
}

/** Drop a trailing `/agent …` slash command from the draft. */
function stripTrailingAgentSlash(text: string): string {
  return text.replace(/\/agent\b[\s\S]*$/i, "").trimEnd();
}

type SlashCmdDef = {
  id: SlashCmdId;
  label: string;
  description: string;
  /** Hide in direct chats. */
  groupOnly?: boolean;
};

/** Parse leading slash command: `/topic Title` → { cmd: "topic", arg: "Title" }. */
function parseSlashDraft(text: string): { cmd: string; arg: string } | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/")) return null;
  const m = trimmed.match(/^\/(\S*)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  return { cmd: (m[1] || "").toLowerCase(), arg: (m[2] || "").trim() };
}

/** Menu open while typing the command token (no args yet). */
function isSlashMenuDraft(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/")) return false;
  return !/\s/.test(trimmed.slice(1));
}

const LOCAL_TOPIC_START_PREFIX = "local-topic-start:";

function isLocalTopicStartMessage(m: ChatMessage): boolean {
  if (String(m.message_id).startsWith(LOCAL_TOPIC_START_PREFIX)) return true;
  return m.sender_type === "system" && m.metadata?.kind === "topic_started";
}

/** Keep client-only "Started #…" markers across listMessages refreshes. */
function mergeServerMessagesWithLocalTopicMarkers(
  server: ChatMessage[],
  prev: ChatMessage[],
): ChatMessage[] {
  const locals = prev.filter(isLocalTopicStartMessage);
  if (locals.length === 0) return server;
  const keep = locals.filter(
    (l) =>
      !!l.thread_id &&
      !server.some(
        (m) =>
          m.thread_id === l.thread_id &&
          !isLocalTopicStartMessage(m) &&
          m.sender_type !== "system",
      ),
  );
  if (keep.length === 0) return server;
  const out = [...server];
  for (const marker of keep) {
    if (out.some((m) => m.message_id === marker.message_id)) continue;
    const idx = out.findIndex((m) => m.thread_id === marker.thread_id);
    if (idx === -1) out.push(marker);
    else out.splice(idx, 0, marker);
  }
  return out;
}

/**
 * Horizontal rule marking a topic boundary on the main timeline.
 * Click highlights the segment only — filtered topic view opens from Topics list.
 */
function TopicDivider({
  title,
  caption,
  highlighted,
  onHighlight,
  borderColor,
  accentSoft,
}: {
  title: string;
  caption?: string;
  highlighted?: boolean;
  onHighlight?: () => void;
  borderColor: string;
  accentSoft: string;
}) {
  const label = (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        maxWidth: 220,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#93c5fd",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        # {title}
      </span>
      {caption ? (
        <span style={{ fontSize: 10, color: "rgba(148,163,184,0.95)" }}>{caption}</span>
      ) : null}
    </span>
  );
  const pillStyle: CSSProperties = {
    border: `1px solid ${highlighted ? "rgba(147,197,253,0.65)" : borderColor}`,
    background: highlighted ? "rgba(147,197,253,0.22)" : accentSoft,
    borderRadius: 999,
    padding: caption ? "4px 12px" : "2px 10px",
    cursor: onHighlight ? "pointer" : "default",
    display: "inline-flex",
    maxWidth: "75%",
    boxShadow: highlighted ? "0 0 0 2px rgba(147,197,253,0.25)" : undefined,
    transition: "background 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
  };
  return (
    <div
      data-topic-divider={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        alignSelf: "stretch",
        width: "100%",
        margin: "8px 0 4px",
      }}
    >
      <div style={{ flex: 1, height: 1, background: borderColor }} />
      {onHighlight ? (
        <button type="button" onClick={onHighlight} title={title} style={pillStyle}>
          {label}
        </button>
      ) : (
        <span style={pillStyle}>{label}</span>
      )}
      <div style={{ flex: 1, height: 1, background: borderColor }} />
    </div>
  );
}

function isAuthFailure(err: unknown): boolean {
  if (err instanceof ChatGatewayError) {
    return err.status === 401 || err.code === "not_authenticated";
  }
  if (err instanceof Error) {
    return /not authenticated/i.test(err.message);
  }
  return false;
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
  onManageAgents,
  t,
}: {
  account: RanchChatAccount;
  onLogout?: () => void;
  onManageAgents?: () => void;
  t: RanchMessages;
}) {
  const label = (account.name || account.email || t.account).trim();
  const initial = label.slice(0, 1).toUpperCase() || "?";
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const menuItemStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    border: "none",
    background: "transparent",
    color: colors.text,
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        borderTop: `1px solid ${colors.border}`,
        flexShrink: 0,
        background: colors.panel,
        zIndex: 20,
      }}
    >
      {menuOpen ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: "100%",
            marginBottom: 6,
            background: "#1c2330",
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            overflow: "hidden",
            zIndex: 30,
          }}
        >
          {onManageAgents ? (
            <button
              type="button"
              role="menuitem"
              style={menuItemStyle}
              onClick={() => {
                setMenuOpen(false);
                onManageAgents();
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span aria-hidden style={{ width: 16, textAlign: "center", color: colors.muted }}>
                ◇
              </span>
              {t.myAgentsManage}
            </button>
          ) : null}
          {onManageAgents && onLogout ? (
            <div style={{ height: 1, background: colors.border, margin: "2px 0" }} />
          ) : null}
          {onLogout ? (
            <button
              type="button"
              role="menuitem"
              style={menuItemStyle}
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span aria-hidden style={{ width: 16, textAlign: "center", color: colors.muted }}>
                ↗
              </span>
              {t.logOut}
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          width: "100%",
          border: "none",
          background: menuOpen ? colors.hover : "transparent",
          color: colors.text,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textAlign: "left",
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
        <span
          aria-hidden
          title={t.account}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.muted,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ⚙
        </span>
      </button>
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
    onReauth,
    connectGuideUrl,
    agentPlanetBaseUrl,
    interfazeBaseUrl,
    locale: localeProp,
    onLocaleChange,
    onOwnedAgentUpdated,
    onOwnedAgentRemoved,
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
  /** agent_id → presence status (group chats; from participants API). */
  const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({});
  /** Ranch-style: tap header → members panel. */
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showMyAgents, setShowMyAgents] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [addMemberId, setAddMemberId] = useState("");
  const [addMemberShowPaste, setAddMemberShowPaste] = useState(false);
  const [addMemberDiscoverQ, setAddMemberDiscoverQ] = useState("");
  const [addMemberDiscoverRows, setAddMemberDiscoverRows] = useState<AgentDirectoryItem[]>([]);
  const [addMemberDiscoverLoading, setAddMemberDiscoverLoading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [agentRefIndex, setAgentRefIndex] = useState(0);
  const [slashIndex, setSlashIndex] = useState(0);
  const [draft, setDraft] = useState("");
  /** Group: continue with last @'d agent for 15m (chip above composer). */
  const [stickyMention, setStickyMention] = useState<StickyMention | null>(null);
  /** Group: forced recipient picker when send has no @ / sticky (ranch-style). */
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  /** Detail panel tab. Group: members | topics. Direct: info | settings? | wallet? | topics. */
  const [infoTab, setInfoTab] = useState<"info" | "settings" | "wallet" | "members" | "topics">("info");
  /** Owned-agent ACN detail for Info (read-only) + Settings (manage). */
  const [ownedAgentDetail, setOwnedAgentDetail] = useState<MyAgentSummary | null>(null);
  const [ownedAgentLoading, setOwnedAgentLoading] = useState(false);
  const [topics, setTopics] = useState<ThreadSummary[]>([]);
  const [activeTopic, setActiveTopic] = useState<ThreadSummary | null>(null);
  /**
   * Product model: topic = segment label on the main timeline; Topics list =
   * directory; filtered view (activeTopic) is secondary (list only).
   * composerTopic tags outbound sends without leaving the full timeline.
   */
  const [composerTopic, setComposerTopic] = useState<ThreadSummary | null>(null);
  /** Brief flash when tapping a timeline topic divider (does not open filter view). */
  const [highlightTopicId, setHighlightTopicId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [topicTitleDraft, setTopicTitleDraft] = useState("");
  const [topicDescDraft, setTopicDescDraft] = useState("");
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  /** Agent-slot: typing → timeout+retry (not endless spinner). */
  const [replySlot, setReplySlot] = useState<null | {
    chatId: string;
    phase: "pending" | "timeout";
    reason?: ReplyTimeoutReason;
  }>(null);
  /**
   * Per-chat: last outbound delivery was queued/failed (or unreachable).
   * Forces the presence dot gray even when ACN still reports online.
   */
  const [deliveryBrokenByChat, setDeliveryBrokenByChat] = useState<Record<string, boolean>>(
    {},
  );
  const replySlotChatIdRef = useRef<string | null>(null);
  const awaitingSinceRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  /** Latest send() for slash /topic (defined later in the component body). */
  const sendRef = useRef<
    | ((opts?: {
        forceMentions?: string[];
        text?: string;
        threadId?: string | null;
      }) => Promise<void>)
    | null
  >(null);
  /** Bumps on each conversation open / chat switch to ignore stale listMessages. */
  const loadSeqRef = useRef(0);
  /** Cancels in-flight post-send poll when chat switches or a newer send starts. */
  const replyPollGenRef = useRef(0);
  /** Active agent participant ids for group mention delivery. */
  const agentIdsRef = useRef<string[]>([]);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = active?.chat_id ?? null;

  const setDeliveryBroken = useCallback((chatId: string, broken: boolean) => {
    setDeliveryBrokenByChat((prev) => {
      const cur = !!prev[chatId];
      if (cur === broken) return prev;
      if (broken) return { ...prev, [chatId]: true };
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }, []);

  const syncDeliveryHealth = useCallback(
    (chatId: string, msgs: ChatMessage[]) => {
      setDeliveryBroken(chatId, latestUserDeliveryBroken(msgs));
    },
    [setDeliveryBroken],
  );

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

  const markReplyTimeout = useCallback(
    (chatId: string, reason: ReplyTimeoutReason = "timeout") => {
      if (replySlotChatIdRef.current !== chatId) return;
      if (reason === "offline") setDeliveryBroken(chatId, true);
      setReplySlot({ chatId, phase: "timeout", reason });
    },
    [setDeliveryBroken],
  );

  const noteAgentActivity = useCallback(
    (chatId: string, msgs: ChatMessage[]) => {
      // Keep list/header dots in sync even when not awaiting a reply slot.
      syncDeliveryHealth(chatId, msgs);
      if (replySlotChatIdRef.current !== chatId) return;
      const since = awaitingSinceRef.current;
      const hasReply = msgs.some(
        (m) =>
          m.sender_type === "agent" &&
          Date.parse(m.created_at) >= since - 2000,
      );
      if (hasReply) {
        setDeliveryBroken(chatId, false);
        clearReplySlot(chatId);
        return;
      }
      // Transport delivery failed / queued offline → stop spinning with a clear reason.
      const recentUser = [...msgs].reverse().find((m) => m.sender_type === "user");
      if (!recentUser || Date.parse(recentUser.created_at) < since - 2000) return;
      const delivery = recentUser.metadata?.delivery;
      if (delivery === "failed") {
        setDeliveryBroken(chatId, true);
        clearReplySlot(chatId);
        return;
      }
      if (delivery === "queued") {
        markReplyTimeout(chatId, "offline");
      }
    },
    [clearReplySlot, markReplyTimeout, setDeliveryBroken, syncDeliveryHealth],
  );

  const refreshChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const list = await client.listChats();
      setChats(list);
      setError(null);
    } catch (e) {
      setError(
        isAuthFailure(e)
          ? t.sessionExpired
          : e instanceof Error
            ? e.message
            : "Failed to load chats",
      );
    } finally {
      setLoadingChats(false);
    }
  }, [client, t.sessionExpired]);

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

  useEffect(() => {
    if (!showAddMember) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setAddMemberDiscoverLoading(true);
      void searchDiscover(addMemberDiscoverQ)
        .then((rows) => {
          if (!cancelled) {
            setAddMemberDiscoverRows(rows.filter((a) => !isAgentInGroup(a.agent_id, agentNames)));
          }
        })
        .catch(() => {
          if (!cancelled) setAddMemberDiscoverRows([]);
        })
        .finally(() => {
          if (!cancelled) setAddMemberDiscoverLoading(false);
        });
    }, addMemberDiscoverQ ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [showAddMember, addMemberDiscoverQ, searchDiscover, agentNames]);

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

  const flashTopicHighlight = useCallback((topicId: string) => {
    setHighlightTopicId(topicId);
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightTopicId((cur) => (cur === topicId ? null : cur));
      highlightTimerRef.current = null;
    }, 1200);
    const safe = topicId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const el = listRef.current?.querySelector(`[data-topic-id="${safe}"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  const reloadMessages = useCallback(
    async (chatId: string, seq?: number) => {
      const msgs = await client.listMessages(chatId);
      if (seq != null && seq !== loadSeqRef.current) return;
      if (activeChatIdRef.current !== chatId) return;
      setMessages((prev) => mergeServerMessagesWithLocalTopicMarkers(msgs, prev));
      syncDeliveryHealth(chatId, msgs);
    },
    [client, syncDeliveryHealth],
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
      setAgentStatuses({});
      setShowMembersPanel(false);
      setShowAddMember(false);
      setEditingTitle(false);
      setInfoTab(isGroupChat(chat) ? "members" : "info");
      setOwnedAgentDetail(null);
      setShowCreateTopic(false);
      setTopicTitleDraft("");
      setTopicDescDraft("");
      setActiveTopic(null);
      setComposerTopic(null);
      setHighlightTopicId(null);
      setTopics([]);
      setTitleDraft(chat.title?.trim() || "");
      setMentionIndex(0);
      setDraft("");
      setRecipientPickerOpen(false);
      setStickyMention(isGroupChat(chat) ? readStickyMention(chat.chat_id) : null);
      clearReplySlot();
      agentIdsRef.current = [];
      try {
        const [msgs, participants, threadList] = await Promise.all([
          client.listMessages(chat.chat_id),
          isGroupChat(chat)
            ? client.listParticipants(chat.chat_id).catch(() => [])
            : Promise.resolve([]),
          client.listThreads(chat.chat_id).catch(() => [] as ThreadSummary[]),
        ]);
        if (seq !== loadSeqRef.current) return;
        setMessages(msgs);
        syncDeliveryHealth(chat.chat_id, msgs);
        setTopics(threadList);
        const agents = participants.filter(
          (p) => p.participant_type === "agent" && p.is_active !== false,
        );
        agentIdsRef.current = agents.map((p) => p.participant_id);
        const labels = resolveParticipantLabels(agents, directoryAgents);
        setAgentNames(labels);
        const statuses: Record<string, string> = {};
        for (const p of agents) {
          if (typeof p.agent_status === "string" && p.agent_status) {
            statuses[p.participant_id] = p.agent_status;
          }
        }
        setAgentStatuses(statuses);
        setStickyMention((cur) => {
          if (!isGroupChat(chat)) return null;
          const sticky = cur ?? readStickyMention(chat.chat_id);
          if (!sticky) return null;
          if (!agentIdsRef.current.includes(sticky.agentId)) {
            writeStickyMention(chat.chat_id, null);
            return null;
          }
          const refreshed = {
            ...sticky,
            name: labels[sticky.agentId] || sticky.name,
          };
          writeStickyMention(chat.chat_id, refreshed);
          return refreshed;
        });
        // Clear unread locally — avoid full listChats refresh (list flash on every click).
        void client.markChatAsRead(chat.chat_id)
          .then(() => {
            setChats((prev) =>
              prev.map((c) =>
                c.chat_id === chat.chat_id ? { ...c, unread_count: 0 } : c,
              ),
            );
          })
          .catch(() => {});
      } catch (e) {
        if (seq !== loadSeqRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load messages");
      }
    },
    [client, clearReplySlot, directoryAgents, syncDeliveryHealth],
  );

  const loadTopics = useCallback(
    async (chatId: string) => {
      setLoadingTopics(true);
      try {
        const list = await client.listThreads(chatId);
        setTopics(list);
      } catch {
        /* keep previous topics on transient errors */
      } finally {
        setLoadingTopics(false);
      }
    },
    [client],
  );

  const openTopic = useCallback((topic: ThreadSummary) => {
    setActiveTopic(topic);
    setComposerTopic(topic);
    setShowMembersPanel(false);
    setShowAddMember(false);
    setShowCreateTopic(false);
  }, []);

  /** Create topic, list it, keep main timeline — next sends tag this thread. */
  const startTopicInTimeline = useCallback(
    (created: ThreadSummary) => {
      setTopics((prev) => [created, ...prev.filter((tp) => tp.id !== created.id)]);
      setComposerTopic(created);
      setActiveTopic(null);
      setShowMembersPanel(false);
      setShowAddMember(false);
      setShowCreateTopic(false);
      setTopicTitleDraft("");
      setTopicDescDraft("");
      setDraft("");
      flashTopicHighlight(created.id);
    },
    [flashTopicHighlight],
  );

  const exitTopicFilter = useCallback(() => {
    // Leaving the filtered topic view also leaves the posting context —
    // otherwise × / ← feel like "closed" but sends still tag the topic.
    setActiveTopic(null);
    setComposerTopic(null);
  }, []);

  const runSlashCommand = useCallback(
    async (cmdId: SlashCmdId, arg = "") => {
      if (!active) return;
      const group = isGroupChat(active);
      if (cmdId === "topic") {
        const title = arg.trim() || t.defaultTopicTitle;
        setBusy(true);
        setError(null);
        try {
          const created = await client.createThread(active.chat_id, { title });
          startTopicInTimeline(created);
          // Title is also a real outbound message in that topic (not only a divider).
          await sendRef.current?.({ text: title, threadId: created.id });
        } catch (e) {
          setError(e instanceof Error ? e.message : t.sendFailed);
          setBusy(false);
        }
        return;
      }
      if (cmdId === "agent") {
        // Keep `/agent ` (optional filter) so the reference picker opens; insert is not delivery.
        const q = arg.trim();
        setDraft(q ? `/agent ${q}` : "/agent ");
        setAgentRefIndex(0);
        setError(null);
        return;
      }
      if (cmdId === "members") {
        if (!group) return;
        setDraft("");
        setShowAddMember(false);
        setShowCreateTopic(false);
        setInfoTab("members");
        setShowMembersPanel(true);
        return;
      }
      if (cmdId === "info") {
        setDraft("");
        setShowAddMember(false);
        setShowCreateTopic(false);
        setInfoTab(group ? "members" : "info");
        setShowMembersPanel(true);
      }
    },
    [active, client, startTopicInTimeline, t.defaultTopicTitle, t.sendFailed],
  );

  const reloadParticipants = useCallback(
    async (chatId: string) => {
      const participants = await client.listParticipants(chatId);
      const agents = participants.filter(
        (p) => p.participant_type === "agent" && p.is_active !== false,
      );
      agentIdsRef.current = agents.map((p) => p.participant_id);
      const labels = resolveParticipantLabels(agents, directoryAgents);
      setAgentNames(labels);
      const statuses: Record<string, string> = {};
      for (const p of agents) {
        if (typeof p.agent_status === "string" && p.agent_status) {
          statuses[p.participant_id] = p.agent_status;
        }
      }
      setAgentStatuses(statuses);
      setStickyMention((cur) => {
        if (!cur) return null;
        if (!agentIdsRef.current.includes(cur.agentId)) {
          writeStickyMention(chatId, null);
          return null;
        }
        const refreshed = { ...cur, name: labels[cur.agentId] || cur.name };
        writeStickyMention(chatId, refreshed);
        return refreshed;
      });
      // Patch member counts on the open chat only — full listChats refresh
      // flashes the sidebar on every add/remove.
      const totalMembers = agents.length;
      const activeMembers = agents.filter(
        (p) => (p.agent_status || "").toLowerCase() === "active",
      ).length;
      const patch = (c: ChatSummary): ChatSummary =>
        c.chat_id === chatId
          ? { ...c, total_members: totalMembers, active_members: activeMembers }
          : c;
      setChats((prev) => prev.map(patch));
      setActive((cur) => (cur && cur.chat_id === chatId ? patch(cur) : cur));
    },
    [client, directoryAgents],
  );

  const clearStickyMention = useCallback((chatId?: string) => {
    const id = chatId ?? activeChatIdRef.current;
    if (id) writeStickyMention(id, null);
    setStickyMention(null);
  }, []);

  const setStickyForAgent = useCallback(
    (chatId: string, agentId: string, name: string) => {
      const next: StickyMention = { agentId, name, setAt: Date.now() };
      writeStickyMention(chatId, next);
      setStickyMention(next);
    },
    [],
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
              setMessages((prev) => mergeServerMessagesWithLocalTopicMarkers(msgs, prev));
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

  type SendOpts = {
    forceMentions?: string[];
    /** Override composer draft (e.g. /topic title as first message). */
    text?: string;
    /** Override topic tagging (e.g. newly created thread id). */
    threadId?: string | null;
  };

  const send = async (opts?: SendOpts) => {
    const text = (opts?.text ?? draft).trim();
    if (!text || !active) return;
    const chatId = active.chat_id;
    const group = isGroupChat(active);
    const seq = loadSeqRef.current;
    const pollGen = ++replyPollGenRef.current;
    setBusy(true);
    setError(null);
    setRecipientPickerOpen(false);
    try {
      if (group && agentIdsRef.current.length === 0) {
        const participants = await client.listParticipants(chatId);
        if (seq !== loadSeqRef.current) return;
        const agents = participants.filter(
          (p) => p.participant_type === "agent" && p.is_active !== false,
        );
        agentIdsRef.current = agents.map((p) => p.participant_id);
        setAgentNames(resolveParticipantLabels(agents, directoryAgents));
        const statuses: Record<string, string> = {};
        for (const p of agents) {
          if (typeof p.agent_status === "string" && p.agent_status) {
            statuses[p.participant_id] = p.agent_status;
          }
        }
        setAgentStatuses(statuses);
      }
      let mentions: string[] | undefined;
      if (group) {
        if (opts?.forceMentions && opts.forceMentions.length > 0) {
          mentions = opts.forceMentions;
        } else {
          const resolved = resolveStickyMentions(
            text,
            agentIdsRef.current,
            agentNames,
            stickyMention,
          );
          if (resolved.mentions.length === 0) {
            setDraft(text);
            setRecipientPickerOpen(true);
            setMentionIndex(0);
            setBusy(false);
            return;
          }
          mentions = resolved.mentions;
        }
      }
      beginAwaitingReply(chatId);
      const sentWhileOffline = !group && isAgentOffline(active?.agent_status);
      const sendThreadId =
        opts?.threadId !== undefined
          ? opts.threadId
          : (activeTopic?.id ?? composerTopic?.id ?? null);
      await client.sendMessage(chatId, text, mentions, sendThreadId);
      if (group && mentions) {
        if (mentions.length === 1) {
          const id = mentions[0]!;
          setStickyForAgent(chatId, id, agentNames[id] || stickyMention?.name || shortAgentId(id));
        } else {
          clearStickyMention(chatId);
        }
      }
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
            setMessages((prev) => mergeServerMessagesWithLocalTopicMarkers(msgs, prev));
            const hasNewAgent = msgs.some(
              (m) =>
                m.sender_type === "agent" &&
                Date.parse(m.created_at) >= baseline - 2000,
            );
            if (hasNewAgent) {
              setDeliveryBroken(chatId, false);
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
      if (e instanceof ChatGatewayError && e.code === "agent_unreachable") {
        setDeliveryBroken(chatId, true);
      }
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
  sendRef.current = send;

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
        let mentions: string[] | undefined;
        if (group) {
          const resolved = resolveStickyMentions(
            text,
            agentIdsRef.current,
            agentNames,
            stickyMention,
          );
          if (resolved.mentions.length === 0) {
            setRecipientPickerOpen(true);
            setMentionIndex(0);
            setBusy(false);
            return;
          }
          mentions = resolved.mentions;
        }
        setRecipientPickerOpen(false);
        beginAwaitingReply(chatId);
        // Same thread rule as normal send — do not fall back to lastUser.thread_id
        // or Retry after closing the topic chip would re-enter the old topic.
        await client.sendMessage(
          chatId,
          text,
          mentions,
          activeTopic?.id ?? composerTopic?.id ?? null,
        );
        if (group && mentions) {
          if (mentions.length === 1) {
            const id = mentions[0]!;
            setStickyForAgent(chatId, id, agentNames[id] || stickyMention?.name || shortAgentId(id));
          } else {
            clearStickyMention(chatId);
          }
        }
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
              setMessages((prev) => mergeServerMessagesWithLocalTopicMarkers(msgs, prev));
              const hasNewAgent = msgs.some(
                (m) =>
                  m.sender_type === "agent" &&
                  Date.parse(m.created_at) >= baseline - 2000,
              );
              if (hasNewAgent) {
                setDeliveryBroken(chatId, false);
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
        if (e instanceof ChatGatewayError && e.code === "agent_unreachable") {
          setDeliveryBroken(chatId, true);
        }
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
  const displayMessages = messages.filter((m) => {
    if (isLegacyDeliveryAckBubble(m)) return false;
    if (!activeTopic) return true;
    return m.thread_id === activeTopic.id;
  });
  const mineAgents = directoryAgents.filter((a) => a.group === "mine" && a.agent_id.trim());
  const hasMineAgents = mineAgents.length > 0;

  const isOwnedDirectAgent = (agentId?: string | null): boolean => {
    if (!agentId?.trim()) return false;
    const bare = agentId.replace(/^acn:/, "");
    return mineAgents.some(
      (a) => a.agent_id === agentId || a.agent_id === bare || `acn:${a.agent_id}` === agentId,
    );
  };

  const activeIsOwned =
    !!active && !isGroupChat(active) && isOwnedDirectAgent(active.agent_id);

  useEffect(() => {
    if (!showMembersPanel || !activeIsOwned || !active?.agent_id) {
      return;
    }
    if (infoTab !== "info" && infoTab !== "settings") return;
    let cancelled = false;
    const bare = active.agent_id.replace(/^acn:/, "");
    setOwnedAgentLoading(true);
    void client
      .getMyAgent(bare)
      .then((row) => {
        if (!cancelled) setOwnedAgentDetail(row);
      })
      .catch(() => {
        if (!cancelled) setOwnedAgentDetail(null);
      })
      .finally(() => {
        if (!cancelled) setOwnedAgentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showMembersPanel, activeIsOwned, active?.agent_id, infoTab, client]);

  /** After owner renames an agent: refresh detail, chat titles, @ labels, host directory. */
  const applyOwnedAgentProfileUpdate = (
    row: MyAgentSummary,
    previousName?: string | null,
  ) => {
    const oldName = (previousName ?? ownedAgentDetail?.name ?? "").trim();
    const newName = (row.name || "").trim();
    const key = agentIdKey(row.agent_id);
    setOwnedAgentDetail((prev) =>
      prev && agentIdKey(prev.agent_id) === key ? row : prev,
    );

    if (newName && key) {
      setAgentNames((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (agentIdKey(id) === key) next[id] = newName;
        }
        // Also set bare id key if present as participant id form.
        if (row.agent_id in next) next[row.agent_id] = newName;
        return next;
      });

      const titleMatchesOld = (title: string | null | undefined, agentId: string | null | undefined) => {
        const t = (title || "").trim();
        if (!t) return true;
        if (oldName && t === oldName) return true;
        if (agentId && (t === agentId || agentIdKey(t) === agentIdKey(agentId))) return true;
        return false;
      };

      setChats((prev) =>
        prev.map((c) => {
          if (agentIdKey(c.agent_id) !== key) return c;
          if (!titleMatchesOld(c.title, c.agent_id)) return c;
          return { ...c, title: newName };
        }),
      );

      // Persist title for the open 1:1 when it still tracked the old display name.
      if (
        active &&
        !isGroupChat(active) &&
        agentIdKey(active.agent_id) === key &&
        titleMatchesOld(active.title, active.agent_id)
      ) {
        void client.updateChat(active.chat_id, { title: newName }).catch(() => {
          /* best-effort */
        });
      }
    }

    onOwnedAgentUpdated?.({
      agent_id: row.agent_id,
      name: row.name,
      description: row.description,
    });
  };

  const applyOwnedAgentRemoved = (agentId: string) => {
    const key = agentIdKey(agentId);
    setOwnedAgentDetail((prev) =>
      prev && agentIdKey(prev.agent_id) === key ? null : prev,
    );
    if (infoTab === "settings" || infoTab === "wallet") setInfoTab("info");
    onOwnedAgentRemoved?.(agentId);
  };

  const activeDeliveryBroken =
    !!active &&
    !isGroupChat(active) &&
    (!!deliveryBrokenByChat[active.chat_id] ||
      latestUserDeliveryBroken(messages) ||
      (replySlot?.chatId === active.chat_id &&
        replySlot.phase === "timeout" &&
        replySlot.reason === "offline"));
  const activePresence = presenceForDot(active?.agent_status, activeDeliveryBroken);
  const activeOffline =
    active && !isGroupChat(active) && isAgentOffline(activePresence);
  const groupActive = !!(active && isGroupChat(active));
  const slashParsed = parseSlashDraft(draft);
  const slashMenuOpen = isSlashMenuDraft(draft);
  const slashCommands: SlashCmdDef[] = (
    [
      { id: "topic" as const, label: "/topic", description: t.slashTopicDesc },
      { id: "agent" as const, label: "/agent", description: t.slashAgentDesc },
      {
        id: "members" as const,
        label: "/members",
        description: t.slashMembersDesc,
        groupOnly: true,
      },
      // Direct only — group detail has Members, not a separate Info tab.
      {
        id: "info" as const,
        label: "/info",
        description: t.slashInfoDesc,
        groupOnly: false,
      },
    ] satisfies SlashCmdDef[]
  ).filter((c) => {
    if (c.id === "info" && groupActive) return false;
    if (c.groupOnly && !groupActive) return false;
    return true;
  });
  const slashCandidates = slashCommands.filter((c) => {
    if (!slashMenuOpen || !slashParsed) return false;
    const q = slashParsed.cmd;
    if (!q) return true;
    return c.id.startsWith(q) || c.label.slice(1).startsWith(q);
  });
  /** `/agent ` or `/agent query` → reference picker (not delivery @). */
  const agentRefOpen =
    !!slashParsed &&
    slashParsed.cmd === "agent" &&
    !isSlashMenuDraft(draft) &&
    !recipientPickerOpen;
  const agentRefQuery = (agentRefOpen ? slashParsed?.arg || "" : "").toLowerCase();
  const agentRefCandidates = (() => {
    if (!agentRefOpen) return [] as Array<{ id: string; name: string }>;
    const map = new Map<string, string>();
    for (const [id, name] of Object.entries(agentNames)) {
      const label = name.trim() || shortAgentId(id);
      map.set(id, label);
    }
    for (const a of directoryAgents) {
      const id = a.agent_id.trim();
      if (!id || map.has(id)) continue;
      map.set(id, a.name?.trim() || shortAgentId(id));
    }
    if (active && !isGroupChat(active) && active.agent_id) {
      const id = active.agent_id;
      if (!map.has(id)) {
        map.set(id, active.title?.trim() || shortAgentId(id));
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .filter(({ id, name }) => {
        if (!agentRefQuery) return true;
        return (
          name.toLowerCase().includes(agentRefQuery) ||
          id.toLowerCase().includes(agentRefQuery)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  })();
  const mentionQuery = groupActive ? trailingMentionQuery(draft) : null;
  const mentionOpen =
    !slashMenuOpen && !agentRefOpen && (mentionQuery !== null || recipientPickerOpen);
  const mentionCandidates = Object.entries(agentNames)
    .filter(([id, name]) => {
      if (!mentionOpen) return false;
      const q = (mentionQuery || "").toLowerCase();
      if (!q) return true;
      return (
        name.toLowerCase().includes(q) ||
        id.toLowerCase().includes(q) ||
        "all".startsWith(q)
      );
    })
    .map(([id, name]) => ({ id, name }));

  const tryRunSlashFromDraft = () => {
    const parsed = parseSlashDraft(draft);
    if (!parsed) return false;
    // Bare "/" — keep menu open, don't send as chat text.
    if (!parsed.cmd) {
      return true;
    }
    // `/agent …` with picker open: Enter inserts highlighted ref, not "run command".
    if (parsed.cmd === "agent" && agentRefOpen) {
      return true;
    }
    const match =
      slashCommands.find((c) => c.id === parsed.cmd) ||
      slashCommands.find((c) => c.label.slice(1) === parsed.cmd);
    if (!match) {
      setError(t.slashUnknown(parsed.cmd));
      return true;
    }
    setError(null);
    void runSlashCommand(match.id, parsed.arg);
    return true;
  };

  /** Forced picker: pick → send immediately (no @ inserted into draft). */
  const pickRecipientAndSend = (label: string) => {
    if (label === "all") {
      void send({ forceMentions: [...agentIdsRef.current] });
      return;
    }
    const entry = Object.entries(agentNames).find(
      ([, name]) => name === label || name.toLowerCase() === label.toLowerCase(),
    );
    if (!entry) return;
    void send({ forceMentions: [entry[0]] });
  };

  /** Insert 「Name」 reference; strips trailing `/agent …`. Never adds delivery mentions. */
  const insertAgentRef = (displayName: string) => {
    const ref = formatAgentRef(displayName);
    setDraft((prev) => {
      const base = stripTrailingAgentSlash(prev);
      if (!base) return `${ref} `;
      return `${base} ${ref} `;
    });
    setAgentRefIndex(0);
    setError(null);
  };

  const insertMention = (label: string) => {
    if (recipientPickerOpen && mentionQuery === null) {
      pickRecipientAndSend(label);
      return;
    }
    setDraft((prev) => {
      const next = prev.replace(/@[^\s@]*$/, `@${label} `);
      return next === prev ? `${prev.replace(/\s*$/, "")} @${label} `.replace(/^\s+/, "") : next;
    });
    setMentionIndex(0);
    setRecipientPickerOpen(false);
    const chatId = active?.chat_id;
    if (!chatId || !groupActive) return;
    if (label === "all") {
      clearStickyMention(chatId);
      return;
    }
    const entry = Object.entries(agentNames).find(
      ([, name]) => name === label || name.toLowerCase() === label.toLowerCase(),
    );
    if (entry) setStickyForAgent(chatId, entry[0], entry[1]);
  };

  const stickyChipActive =
    groupActive &&
    !!stickyMention &&
    Date.now() - stickyMention.setAt <= STICKY_MENTION_TTL_MS &&
    agentIdsRef.current.includes(stickyMention.agentId);

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
              const listPresence = presenceForDot(
                c.agent_status,
                !!deliveryBrokenByChat[c.chat_id],
              );
              const dot = !isGroupChat(c) ? agentStatusDotColor(listPresence) : null;
              return (
                <button
                  key={c.chat_id}
                  type="button"
                  onClick={() => void openConversation(c)}
                  title={
                    !isGroupChat(c)
                      ? [c.agent_id, agentStatusTitle(listPresence, t)].filter(Boolean).join(" · ") ||
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
                        title={agentStatusTitle(listPresence, t)}
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
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: colors.muted }}>
                          {formatRelativeTime(c.last_message_at, t)}
                        </span>
                        {(c.unread_count ?? 0) > 0 ? (
                          <span
                            style={{
                              minWidth: 18,
                              height: 18,
                              padding: "0 5px",
                              borderRadius: 999,
                              background: colors.accent,
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {c.unread_count! > 99 ? "99+" : c.unread_count}
                          </span>
                        ) : null}
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

        {error ? (
          <div
            style={{
              flexShrink: 0,
              padding: "10px 12px",
              borderTop: `1px solid ${colors.border}`,
              background: "rgba(248,113,113,0.12)",
              color: colors.danger,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              zIndex: 2,
            }}
          >
            <span>{error}</span>
            {/session expired|登录已失效|not authenticated/i.test(error) &&
            (onReauth || onLogout) ? (
              <div style={{ display: "flex", gap: 8 }}>
                {onReauth ? (
                  <button type="button" style={btnPrimary} onClick={() => onReauth()}>
                    {t.reLogin}
                  </button>
                ) : null}
                {onLogout ? (
                  <button type="button" style={btnGhost} onClick={() => onLogout()}>
                    {t.logOut}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {account ? (
          <AccountFooter
            account={account}
            onLogout={onLogout}
            onManageAgents={() => {
              setShowPicker(false);
              setShowMyAgents(true);
            }}
            t={t}
          />
        ) : null}

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

        {showMyAgents ? (
          <MyAgentsPanel
            client={client}
            connectGuideUrl={connectGuideUrl}
            agentPlanetBaseUrl={agentPlanetBaseUrl}
            interfazeBaseUrl={interfazeBaseUrl}
            locale={uiLocale}
            messages={t}
            busy={busy}
            onClose={() => setShowMyAgents(false)}
            onOpenChat={(id) => {
              setShowMyAgents(false);
              void startDirect(id);
            }}
            onAgentUpdated={(row, previousName) => {
              applyOwnedAgentProfileUpdate(row, previousName);
            }}
            onAgentRemoved={applyOwnedAgentRemoved}
          />
        ) : null}
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
                  {(mode === "side" || activeTopic) && (
                    <button
                      type="button"
                      style={btnGhost}
                      onClick={() => {
                        if (activeTopic) {
                          exitTopicFilter();
                          return;
                        }
                        setView("list");
                        setActive(null);
                      }}
                      aria-label={activeTopic ? t.backToMainChat : undefined}
                      title={activeTopic ? t.backToMainChat : undefined}
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
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMember(false);
                      setEditingTitle(false);
                      setInfoTab(
                        activeTopic
                          ? "topics"
                          : active && isGroupChat(active)
                            ? "members"
                            : "info",
                      );
                      setShowMembersPanel(true);
                      if (active) void loadTopics(active.chat_id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                      margin: 0,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    title={
                      activeTopic
                        ? t.topics
                        : isGroupChat(active)
                          ? t.groupInfo
                          : t.agentInfo
                    }
                  >
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
                      {!isGroupChat(active) && agentStatusDotColor(activePresence) ? (
                        <span
                          aria-hidden
                          title={agentStatusTitle(activePresence, t)}
                          style={{
                            position: "absolute",
                            right: -1,
                            bottom: -1,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: agentStatusDotColor(activePresence)!,
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
                        title={
                          activeTopic
                            ? activeTopic.title || t.topics
                            : active.agent_id || undefined
                        }
                      >
                        {activeTopic
                          ? activeTopic.title?.trim() || t.topics
                          : chatTitle(active)}
                      </strong>
                      {activeTopic ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: colors.muted,
                          }}
                        >
                          {t.backToMainChat} · {chatTitle(active)}
                        </span>
                      ) : isGroupChat(active) ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: colors.muted,
                          }}
                        >
                          {t.agentsOnlineCount(
                            active.active_members ?? 0,
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
                  </button>
                </div>
                {mode === "side" ? (
                  <button
                    type="button"
                    style={btnGhost}
                    onClick={() => {
                      if (activeTopic) {
                        exitTopicFilter();
                        return;
                      }
                      setView("list");
                      setActive(null);
                    }}
                    aria-label={activeTopic ? t.backToMainChat : t.close}
                    title={activeTopic ? t.backToMainChat : t.close}
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
                {displayMessages.length === 0 && (
                  <p style={{ color: colors.muted, fontSize: 13, margin: 0 }}>
                    {activeTopic ? t.noMessagesYet : t.sayHello}
                  </p>
                )}
                {displayMessages.map((m, idx) => {
                  const isUser = m.sender_type === "user";
                  const topicStart = isLocalTopicStartMessage(m);
                  const delivery =
                    isUser && typeof m.metadata?.delivery === "string" ? m.metadata.delivery : null;
                  const deliveryByAgent =
                    isUser &&
                    m.metadata?.delivery_by_agent &&
                    typeof m.metadata.delivery_by_agent === "object"
                      ? (m.metadata.delivery_by_agent as Record<string, string>)
                      : null;
                  const group = active ? isGroupChat(active) : false;
                  const senderLabel =
                    !isUser && !topicStart && group
                      ? agentNames[m.sender_id]?.trim() ||
                        shortAgentId(m.sender_id) ||
                        m.sender_id
                      : null;
                  const topicLabel =
                    !activeTopic && m.thread_id
                      ? m.thread_title?.trim() ||
                        topics.find((tp) => tp.id === m.thread_id)?.title?.trim() ||
                        t.topics
                      : null;
                  const prev = idx > 0 ? displayMessages[idx - 1] : null;
                  const enteringTopic =
                    !activeTopic &&
                    !!m.thread_id &&
                    (prev?.thread_id || null) !== m.thread_id;
                  const dividerTitle = topicLabel || t.topics;
                  const highlight = !!m.thread_id && highlightTopicId === m.thread_id;
                  if (topicStart) {
                    // Filter view: skip marker (list already scoped to this topic).
                    if (activeTopic) return null;
                    return (
                      <div key={m.message_id} data-topic-id={m.thread_id || undefined}>
                        <TopicDivider
                          title={dividerTitle}
                          caption={m.content || t.topicStarted(dividerTitle)}
                          highlighted={highlight}
                          onHighlight={
                            m.thread_id ? () => flashTopicHighlight(m.thread_id!) : undefined
                          }
                          borderColor={colors.border}
                          accentSoft={colors.accentSoft}
                        />
                      </div>
                    );
                  }
                  return (
                    <Fragment key={m.message_id}>
                      {enteringTopic &&
                      topicLabel &&
                      !(prev && isLocalTopicStartMessage(prev)) ? (
                        <div data-topic-id={m.thread_id || undefined}>
                          <TopicDivider
                            title={topicLabel}
                            highlighted={highlight}
                            onHighlight={
                              m.thread_id ? () => flashTopicHighlight(m.thread_id!) : undefined
                            }
                            borderColor={colors.border}
                            accentSoft={colors.accentSoft}
                          />
                        </div>
                      ) : null}
                    <div
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
                      {isUser && (delivery || deliveryByAgent) ? (
                        <DeliveryStatusFooter
                          delivery={delivery}
                          byAgent={deliveryByAgent}
                          names={agentNames}
                          t={t}
                        />
                      ) : null}
                    </div>
                    </Fragment>
                  );
                })}
                {!activeTopic &&
                composerTopic &&
                (displayMessages.length === 0 ||
                  displayMessages[displayMessages.length - 1]?.thread_id !==
                    composerTopic.id) ? (
                  <div data-topic-id={composerTopic.id}>
                    <TopicDivider
                      title={composerTopic.title?.trim() || t.topics}
                      caption={t.topicStarted(composerTopic.title?.trim() || t.topics)}
                      highlighted={highlightTopicId === composerTopic.id}
                      onHighlight={() => flashTopicHighlight(composerTopic.id)}
                      borderColor={colors.border}
                      accentSoft={colors.accentSoft}
                    />
                  </div>
                ) : null}
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
                  if (agentRefOpen) {
                    const pick =
                      agentRefCandidates[agentRefIndex] || agentRefCandidates[0];
                    if (pick) insertAgentRef(pick.name);
                    return;
                  }
                  if (tryRunSlashFromDraft()) return;
                  void send();
                }}
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  position: "relative",
                }}
              >
                {!activeTopic && composerTopic ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      gap: 6,
                      padding: "4px 8px 4px 10px",
                      borderRadius: 999,
                      background: "rgba(147,197,253,0.12)",
                      border: "1px solid rgba(147,197,253,0.28)",
                      fontSize: 12,
                      color: colors.text,
                      maxWidth: "100%",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.postingInTopic(composerTopic.title?.trim() || t.topics)}
                    </span>
                    <button
                      type="button"
                      aria-label={t.close}
                      onClick={() => setComposerTopic(null)}
                      style={{
                        ...btnIcon,
                        width: 20,
                        height: 20,
                        fontSize: 14,
                        lineHeight: 1,
                        color: colors.muted,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : null}
                {stickyChipActive && stickyMention ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      gap: 6,
                      padding: "4px 8px 4px 10px",
                      borderRadius: 999,
                      background: "rgba(147,197,253,0.12)",
                      border: "1px solid rgba(147,197,253,0.28)",
                      fontSize: 12,
                      color: colors.text,
                      maxWidth: "100%",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.continueWith(stickyMention.name)}
                    </span>
                    <button
                      type="button"
                      aria-label={t.close}
                      onClick={() => clearStickyMention(active?.chat_id)}
                      style={{
                        ...btnIcon,
                        width: 20,
                        height: 20,
                        fontSize: 14,
                        lineHeight: 1,
                        color: colors.muted,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, position: "relative" }}>
                {slashMenuOpen && slashCandidates.length > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 72,
                      bottom: "100%",
                      marginBottom: 8,
                      background: colors.panel,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                      zIndex: 6,
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 11,
                        color: colors.muted,
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {t.slashCommands}
                    </div>
                    {slashCandidates.map((cmd, i) => (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={() => {
                          if (cmd.id === "topic") {
                            setDraft("/topic ");
                            setSlashIndex(0);
                            return;
                          }
                          if (cmd.id === "agent") {
                            setDraft("/agent ");
                            setAgentRefIndex(0);
                            setSlashIndex(0);
                            return;
                          }
                          void runSlashCommand(cmd.id);
                        }}
                        style={{
                          ...mentionRow,
                          borderBottom: `1px solid ${colors.border}`,
                          background: slashIndex === i ? colors.hover : "transparent",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{cmd.label}</span>
                        <span style={{ fontSize: 11, color: colors.muted }}>
                          {cmd.description}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {agentRefOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 72,
                      bottom: "100%",
                      marginBottom: 8,
                      background: colors.panel,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                      zIndex: 6,
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 11,
                        color: colors.muted,
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      {t.agentRefPickerTitle}
                    </div>
                    {agentRefCandidates.length === 0 ? (
                      <div style={{ padding: "12px 14px", fontSize: 13, color: colors.muted }}>
                        {t.noAgentsToRef}
                      </div>
                    ) : (
                      agentRefCandidates.map((a, i) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => insertAgentRef(a.name)}
                          style={{
                            ...mentionRow,
                            background: agentRefIndex === i ? colors.hover : "transparent",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{a.name}</span>
                          <span
                            style={{
                              fontSize: 11,
                              color: colors.muted,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {shortAgentId(a.id)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
                {mentionOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 72,
                      bottom: "100%",
                      marginBottom: 8,
                      background: colors.panel,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                      zIndex: 5,
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {recipientPickerOpen && mentionQuery === null ? (
                      <div
                        style={{
                          padding: "8px 12px",
                          fontSize: 11,
                          color: colors.muted,
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        {t.mentionRequired}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => insertMention("all")}
                      style={{
                        ...mentionRow,
                        borderBottom: `1px solid ${colors.border}`,
                        background:
                          mentionIndex === 0 ? colors.hover : "transparent",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{t.mentionAll}</span>
                      <span style={{ fontSize: 11, color: colors.muted }}>
                        {t.mentionAllHint}
                      </span>
                    </button>
                    {mentionCandidates.map((a, i) => {
                      const status = agentStatuses[a.id];
                      const statusLabel = agentStatusTitle(status, t);
                      const dot = agentStatusDotColor(status);
                      return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => insertMention(a.name)}
                        title={statusLabel || undefined}
                        style={{
                          ...mentionRow,
                          background:
                            mentionIndex === i + 1 ? colors.hover : "transparent",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span style={{ position: "relative", flexShrink: 0 }}>
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                background: "linear-gradient(135deg,#0f766e,#1e293b)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {a.name.slice(0, 1).toUpperCase()}
                            </span>
                            {dot ? (
                              <span
                                aria-hidden
                                style={{
                                  position: "absolute",
                                  right: -1,
                                  bottom: -1,
                                  width: 9,
                                  height: 9,
                                  borderRadius: 999,
                                  background: dot,
                                  border: `2px solid ${colors.panel}`,
                                }}
                              />
                            ) : null}
                          </span>
                          <span style={{ fontWeight: 600 }}>@{a.name}</span>
                        </span>
                      </button>
                      );
                    })}
                  </div>
                ) : null}
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setMentionIndex(0);
                    setSlashIndex(0);
                    if (recipientPickerOpen && trailingMentionQuery(e.target.value) !== null) {
                      setRecipientPickerOpen(false);
                    }
                  }}
                  rows={2}
                  placeholder={
                    healthOk === false
                      ? t.gatewayUnavailable
                      : groupActive
                        ? t.groupMessagePlaceholder
                        : t.messagePlaceholder
                  }
                  disabled={busy || healthOk === false}
                  style={{ ...inputStyle, resize: "none", flex: 1 }}
                  onKeyDown={(e) => {
                    if (slashMenuOpen && slashCandidates.length > 0) {
                      const total = slashCandidates.length;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSlashIndex((i) => (i + 1) % total);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSlashIndex((i) => (i - 1 + total) % total);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setDraft("");
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const pick = slashCandidates[slashIndex] || slashCandidates[0];
                        if (!pick) return;
                        if (pick.id === "topic") {
                          // Keep drafting a title after the command.
                          setDraft("/topic ");
                          setSlashIndex(0);
                          return;
                        }
                        if (pick.id === "agent") {
                          setDraft("/agent ");
                          setAgentRefIndex(0);
                          setSlashIndex(0);
                          return;
                        }
                        void runSlashCommand(pick.id);
                        return;
                      }
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const pick = slashCandidates[slashIndex] || slashCandidates[0];
                        if (pick) setDraft(`${pick.label} `);
                        return;
                      }
                    }
                    if (agentRefOpen) {
                      const total = agentRefCandidates.length;
                      if (e.key === "ArrowDown" && total > 0) {
                        e.preventDefault();
                        setAgentRefIndex((i) => (i + 1) % total);
                        return;
                      }
                      if (e.key === "ArrowUp" && total > 0) {
                        e.preventDefault();
                        setAgentRefIndex((i) => (i - 1 + total) % total);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setDraft((prev) => stripTrailingAgentSlash(prev));
                        setAgentRefIndex(0);
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const pick =
                          agentRefCandidates[agentRefIndex] || agentRefCandidates[0];
                        if (pick) insertAgentRef(pick.name);
                        return;
                      }
                    }
                    if (mentionOpen) {
                      const total = mentionCandidates.length + 1; // + @all
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionIndex((i) => (i + 1) % total);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionIndex((i) => (i - 1 + total) % total);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        if (recipientPickerOpen && mentionQuery === null) {
                          setRecipientPickerOpen(false);
                          return;
                        }
                        setDraft((prev) => prev.replace(/@[^\s@]*$/, ""));
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (mentionIndex === 0) insertMention("all");
                        else {
                          const pick = mentionCandidates[mentionIndex - 1];
                          if (pick) insertMention(pick.name);
                        }
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (tryRunSlashFromDraft()) return;
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
                </div>
              </form>

              {showMembersPanel && active ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 30,
                    background: colors.bg,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={listHeader}>
                    <button
                      type="button"
                      style={btnGhost}
                      onClick={() => {
                        setShowMembersPanel(false);
                        setShowAddMember(false);
                        setEditingTitle(false);
                        setShowCreateTopic(false);
                      }}
                      aria-label={t.close}
                    >
                      ←
                    </button>
                    <strong style={{ fontSize: 14 }}>
                      {groupActive ? t.groupInfo : t.agentInfo}
                    </strong>
                    <span style={{ width: 40 }} />
                  </div>
                  <div
                    style={{
                      padding: "20px 16px 12px",
                      textAlign: "center",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: 56,
                        height: 56,
                        margin: "0 auto 10px",
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: groupActive ? 12 : 999,
                          background: "linear-gradient(135deg,#334155,#1e293b)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 22,
                        }}
                      >
                        {chatTitle(active).slice(0, 1).toUpperCase()}
                      </div>
                      {!groupActive && agentStatusDotColor(activePresence) ? (
                        <span
                          aria-hidden
                          title={agentStatusTitle(activePresence, t)}
                          style={{
                            position: "absolute",
                            right: 0,
                            bottom: 0,
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: agentStatusDotColor(activePresence)!,
                            border: `2px solid ${colors.bg}`,
                          }}
                        />
                      ) : null}
                    </div>
                    {editingTitle && groupActive ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          placeholder={t.groupName}
                          style={{ ...inputStyle, textAlign: "center" }}
                          autoFocus
                        />
                        <button
                          type="button"
                          style={btnPrimary}
                          disabled={busy || !titleDraft.trim()}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                const updated = await client.updateChat(active.chat_id, {
                                  title: titleDraft.trim(),
                                });
                                setActive(updated);
                                setEditingTitle(false);
                                await refreshChats();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : t.sendFailed);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {t.save}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{chatTitle(active)}</div>
                        {groupActive ? (
                          <button
                            type="button"
                            style={{
                              ...btnGhost,
                              marginTop: 8,
                              fontSize: 11,
                            }}
                            onClick={() => {
                              setTitleDraft(chatTitle(active));
                              setEditingTitle(true);
                            }}
                          >
                            {t.renameGroup}
                          </button>
                        ) : null}
                      </>
                    )}
                    {groupActive ? (
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
                        {t.agentsOnlineCount(
                          active.active_members ?? 0,
                          Object.keys(agentNames).length || active.total_members || 0,
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      padding: "8px 12px",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    {(groupActive
                      ? ([
                          ["members", t.members],
                          ["topics", t.topics],
                        ] as const)
                      : activeIsOwned
                        ? ([
                            ["info", t.infoTab],
                            ["settings", t.settingsTab],
                            ["wallet", t.walletTab],
                            ["topics", t.topics],
                          ] as const)
                        : ([
                            ["info", t.infoTab],
                            ["topics", t.topics],
                          ] as const)
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setInfoTab(key);
                          setShowAddMember(false);
                          setShowCreateTopic(false);
                          if (key === "topics") void loadTopics(active.chat_id);
                        }}
                        style={{
                          ...btnGhost,
                          flex: 1,
                          fontWeight: infoTab === key ? 650 : 500,
                          background: infoTab === key ? colors.accentSoft : "transparent",
                          color: infoTab === key ? colors.text : colors.muted,
                          borderColor: infoTab === key ? "rgba(59,130,246,0.35)" : colors.border,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {infoTab === "topics" ? (
                    <>
                      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                        {showCreateTopic ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <input
                              value={topicTitleDraft}
                              onChange={(e) => setTopicTitleDraft(e.target.value)}
                              placeholder={t.topicTitle}
                              style={inputStyle}
                              autoFocus
                            />
                            <textarea
                              value={topicDescDraft}
                              onChange={(e) => setTopicDescDraft(e.target.value)}
                              placeholder={t.topicDescription}
                              rows={3}
                              style={{
                                ...inputStyle,
                                resize: "vertical",
                                minHeight: 72,
                                fontFamily: "inherit",
                              }}
                            />
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                style={btnGhost}
                                onClick={() => {
                                  setShowCreateTopic(false);
                                  setTopicTitleDraft("");
                                  setTopicDescDraft("");
                                }}
                              >
                                {t.cancel}
                              </button>
                              <button
                                type="button"
                                style={btnPrimary}
                                disabled={busy || !topicTitleDraft.trim()}
                                onClick={() => {
                                  void (async () => {
                                    const title = topicTitleDraft.trim();
                                    setBusy(true);
                                    try {
                                      const created = await client.createThread(active.chat_id, {
                                        title,
                                        objective: topicDescDraft.trim() || undefined,
                                      });
                                      startTopicInTimeline(created);
                                      await sendRef.current?.({ text: title, threadId: created.id });
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : t.sendFailed);
                                      setBusy(false);
                                    }
                                  })();
                                }}
                              >
                                {t.createTopic}
                              </button>
                            </div>
                          </div>
                        ) : loadingTopics && topics.length === 0 ? (
                          <p style={{ color: colors.muted, textAlign: "center", padding: 24 }}>
                            {t.loading}
                          </p>
                        ) : topics.length === 0 ? (
                          <div
                            style={{
                              textAlign: "center",
                              padding: "28px 12px",
                              color: colors.muted,
                            }}
                          >
                            <p style={{ margin: "0 0 6px", fontSize: 14, color: colors.text }}>
                              {t.noTopicsYet}
                            </p>
                            <p style={{ margin: 0, fontSize: 12 }}>{t.noTopicsHint}</p>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {topics.map((topic) => (
                              <button
                                key={topic.id}
                                type="button"
                                onClick={() => openTopic(topic)}
                                style={{
                                  ...listItem,
                                  background:
                                    activeTopic?.id === topic.id
                                      ? colors.accentSoft
                                      : "transparent",
                                  textAlign: "left",
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 13,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {topic.title?.trim() || t.topics}
                                  </div>
                                  {topic.objective?.trim() ? (
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: colors.muted,
                                        marginTop: 2,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {topic.objective}
                                    </div>
                                  ) : null}
                                  <div
                                    style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}
                                  >
                                    {t.topicMessages(topic.message_count ?? 0)}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {!showCreateTopic ? (
                        <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
                          <button
                            type="button"
                            style={{ ...btnPrimary, width: "100%" }}
                            onClick={() => setShowCreateTopic(true)}
                          >
                            {t.newTopic}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : infoTab === "settings" && !groupActive && activeIsOwned ? (
                    <div
                      style={{
                        flex: 1,
                        overflow: "auto",
                        padding: 16,
                      }}
                    >
                      {ownedAgentLoading && !ownedAgentDetail ? (
                        <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
                      ) : ownedAgentDetail ? (
                        <AgentOwnerSettings
                          client={client}
                          detail={ownedAgentDetail}
                          messages={t}
                          agentPlanetBaseUrl={agentPlanetBaseUrl}
                          interfazeBaseUrl={interfazeBaseUrl}
                          connectGuideUrl={connectGuideUrl}
                          busy={busy}
                          onUpdated={applyOwnedAgentProfileUpdate}
                          onRemoved={applyOwnedAgentRemoved}
                        />
                      ) : (
                        <p style={{ color: colors.danger, fontSize: 13 }}>{t.myAgentsLoadFailed}</p>
                      )}
                    </div>
                  ) : infoTab === "wallet" && !groupActive && activeIsOwned && active?.agent_id ? (
                    <div
                      style={{
                        flex: 1,
                        overflow: "auto",
                        padding: 16,
                      }}
                    >
                      <AgentOwnerWallet
                        client={client}
                        agentId={active.agent_id.replace(/^acn:/i, "")}
                        messages={t}
                        agentPlanetBaseUrl={agentPlanetBaseUrl}
                        busy={busy}
                      />
                    </div>
                  ) : infoTab === "info" && !groupActive ? (
                    <>
                      <div
                        style={{
                          flex: 1,
                          overflow: "auto",
                          padding: "16px 16px 8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              color: colors.muted,
                              marginBottom: 6,
                            }}
                          >
                            {t.statusLabel}
                          </div>
                          <div style={{ fontSize: 13, color: colors.text }}>
                            {activeDeliveryBroken
                              ? t.offline
                              : ownedAgentDetail?.status === "online"
                                ? t.online
                                : ownedAgentDetail?.status === "offline"
                                  ? t.offline
                                  : agentStatusTitle(activePresence, t) || t.offline}
                          </div>
                        </div>
                        {ownedAgentDetail?.name ? (
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                color: colors.muted,
                                marginBottom: 6,
                              }}
                            >
                              {t.agentInfo}
                            </div>
                            <div style={{ fontSize: 13, color: colors.text }}>
                              {ownedAgentDetail.name}
                            </div>
                            {ownedAgentDetail.description ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  color: colors.muted,
                                  lineHeight: 1.45,
                                }}
                              >
                                {ownedAgentDetail.description}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {shortAgentId(active.agent_id) ? (
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                color: colors.muted,
                                marginBottom: 6,
                              }}
                            >
                              {t.agentIdLabel}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: colors.text,
                                fontFamily:
                                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                wordBreak: "break-all",
                              }}
                              title={active.agent_id || undefined}
                            >
                              {active.agent_id}
                            </div>
                          </div>
                        ) : null}
                        {ownedAgentDetail?.delivery ? (
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                color: colors.muted,
                                marginBottom: 6,
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {t.myAgentsDelivery}
                              <FieldHint
                                text={
                                  deliveryValueHint(ownedAgentDetail.delivery, t) ||
                                  t.myAgentsDeliveryHint
                                }
                              />
                            </div>
                            <div style={{ fontSize: 13, color: colors.text }}>
                              {deliveryLabel(ownedAgentDetail.delivery, t)}
                            </div>
                          </div>
                        ) : null}
                        {connectGuideUrl ? (
                          <div>
                            <a
                              href={connectGuideUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#93c5fd", fontSize: 13 }}
                            >
                              {t.ownerHowToConnect}
                            </a>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
                        <button
                          type="button"
                          style={{
                            ...btnGhost,
                            width: "100%",
                            color: colors.danger,
                            borderColor: "rgba(248,113,113,0.35)",
                          }}
                          disabled={busy}
                          onClick={() => {
                            setConfirmDialog({
                              message: t.deleteChatConfirm,
                              confirmLabel: t.deleteChat,
                              onConfirm: () => {
                                void (async () => {
                                  const chatId = active.chat_id;
                                  setBusy(true);
                                  try {
                                    await client.deleteChat(chatId);
                                    setConfirmDialog(null);
                                    setShowMembersPanel(false);
                                    setActiveTopic(null);
                                    setComposerTopic(null);
                                    setTopics([]);
                                    setActive(null);
                                    setView("list");
                                    setMessages([]);
                                    setDraft("");
                                    clearReplySlot();
                                    setChats((prev) => prev.filter((c) => c.chat_id !== chatId));
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : t.sendFailed);
                                  } finally {
                                    setBusy(false);
                                  }
                                })();
                              },
                            });
                          }}
                        >
                          {t.deleteChat}
                        </button>
                      </div>
                    </>
                  ) : !showAddMember ? (
                    <>
                      <div
                        style={{
                          padding: "10px 14px 6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          style={{ ...btnGhost, fontSize: 11 }}
                          disabled={busy}
                          onClick={() => {
                            setAddMemberId("");
                            setAddMemberShowPaste(false);
                            setAddMemberDiscoverQ("");
                            setShowAddMember(true);
                          }}
                        >
                          + {t.addMember}
                        </button>
                      </div>
                      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
                        {Object.entries(agentNames).map(([id, name]) => {
                          const status = agentStatuses[id];
                          const statusLabel = agentStatusTitle(status, t);
                          const dot = agentStatusDotColor(status);
                          return (
                          <div
                            key={id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "10px 8px",
                              borderRadius: 10,
                            }}
                          >
                            <span
                              style={{
                                position: "relative",
                                width: 36,
                                height: 36,
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 999,
                                  background: "linear-gradient(135deg,#0f766e,#1e293b)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  fontSize: 14,
                                }}
                              >
                                {name.slice(0, 1).toUpperCase()}
                              </span>
                              {dot ? (
                                <span
                                  aria-hidden
                                  title={statusLabel}
                                  style={{
                                    position: "absolute",
                                    right: -1,
                                    bottom: -1,
                                    width: 10,
                                    height: 10,
                                    borderRadius: 999,
                                    background: dot,
                                    border: `2px solid ${colors.bg}`,
                                  }}
                                />
                              ) : null}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>
                                {name}
                              </span>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 11,
                                  color: colors.muted,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {statusLabel || shortAgentId(id)}
                              </span>
                            </span>
                            <button
                              type="button"
                              style={btnGhost}
                              disabled={busy}
                              onClick={() => {
                                setShowMembersPanel(false);
                                void startDirect(id);
                              }}
                            >
                              {t.openDirectChat}
                            </button>
                            <button
                              type="button"
                              style={{ ...btnGhost, color: colors.danger }}
                              disabled={busy || Object.keys(agentNames).length <= 1}
                              onClick={() => {
                                setConfirmDialog({
                                  message: t.removeMemberConfirm(name),
                                  confirmLabel: t.removeMember,
                                  onConfirm: () => {
                                    void (async () => {
                                      setBusy(true);
                                      try {
                                        await client.removeParticipant(active.chat_id, id);
                                        setConfirmDialog(null);
                                        await reloadParticipants(active.chat_id);
                                      } catch (e) {
                                        setError(e instanceof Error ? e.message : t.sendFailed);
                                      } finally {
                                        setBusy(false);
                                      }
                                    })();
                                  },
                                });
                              }}
                            >
                              {t.removeMember}
                            </button>
                          </div>
                          );
                        })}
                      </div>
                      <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
                        <button
                          type="button"
                          style={{
                            ...btnGhost,
                            width: "100%",
                            color: colors.danger,
                            borderColor: "rgba(248,113,113,0.35)",
                          }}
                          disabled={busy}
                          onClick={() => {
                            setConfirmDialog({
                              message: t.deleteGroupConfirm,
                              confirmLabel: t.deleteGroup,
                              onConfirm: () => {
                                void (async () => {
                                  const chatId = active.chat_id;
                                  setBusy(true);
                                  try {
                                    await client.deleteChat(chatId);
                                    setConfirmDialog(null);
                                    setShowMembersPanel(false);
                                    setActiveTopic(null);
                                    setComposerTopic(null);
                                    setTopics([]);
                                    setActive(null);
                                    setView("list");
                                    setMessages([]);
                                    setChats((prev) => prev.filter((c) => c.chat_id !== chatId));
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : t.sendFailed);
                                  } finally {
                                    setBusy(false);
                                  }
                                })();
                              },
                            });
                          }}
                        >
                          {t.deleteGroup}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: "10px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        {t.addMemberTitle}
                      </div>
                      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                        {(() => {
                          const addCandidate = async (agentId: string) => {
                            setBusy(true);
                            try {
                              await client.addParticipant(active.chat_id, agentId);
                              await reloadParticipants(active.chat_id);
                              setShowAddMember(false);
                              setAddMemberId("");
                            } catch (e) {
                              setError(e instanceof Error ? e.message : t.sendFailed);
                            } finally {
                              setBusy(false);
                            }
                          };
                          const mineToAdd = directoryAgents.filter(
                            (a) => a.group === "mine" && !isAgentInGroup(a.agent_id, agentNames),
                          );
                          return (
                            <>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  color: colors.muted,
                                  marginBottom: 8,
                                }}
                              >
                                {t.mineAgents}
                              </div>
                              {mineToAdd.length === 0 ? (
                                <p style={{ color: colors.muted, fontSize: 12, margin: "0 0 16px" }}>
                                  {t.noMineAgents}
                                </p>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                    marginBottom: 16,
                                  }}
                                >
                                  {mineToAdd.map((a) => (
                                    <button
                                      key={a.agent_id}
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void addCandidate(a.agent_id)}
                                      style={{
                                        ...listItem,
                                        background: "transparent",
                                        textAlign: "left",
                                      }}
                                    >
                                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                                        {a.name?.trim() || a.agent_id}
                                      </span>
                                      <span style={{ fontSize: 11, color: colors.muted }}>
                                        {a.description?.trim() || shortAgentId(a.agent_id)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  color: colors.muted,
                                  marginBottom: 8,
                                }}
                              >
                                {t.recommended}
                              </div>
                              <input
                                value={addMemberDiscoverQ}
                                onChange={(e) => setAddMemberDiscoverQ(e.target.value)}
                                placeholder={t.searchAgents}
                                style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}
                              />
                              {addMemberDiscoverLoading ? (
                                <p style={{ color: colors.muted, fontSize: 12, margin: 0 }}>
                                  {t.loading}
                                </p>
                              ) : addMemberDiscoverRows.length === 0 ? (
                                <p style={{ color: colors.muted, fontSize: 12, margin: "0 0 12px" }}>
                                  {mineToAdd.length === 0 ? t.noAgentsToAdd : t.noRecommended}
                                </p>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                    marginBottom: 12,
                                  }}
                                >
                                  {addMemberDiscoverRows.map((a) => (
                                    <button
                                      key={a.agent_id}
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void addCandidate(a.agent_id)}
                                      style={{
                                        ...listItem,
                                        background: "transparent",
                                        textAlign: "left",
                                      }}
                                    >
                                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                                        {a.name?.trim() || a.agent_id}
                                      </span>
                                      <span style={{ fontSize: 11, color: colors.muted }}>
                                        {a.description?.trim() || shortAgentId(a.agent_id)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setAddMemberShowPaste((v) => !v)}
                                style={{
                                  ...btnGhost,
                                  fontSize: 11,
                                  padding: "4px 8px",
                                  color: colors.muted,
                                }}
                              >
                                {addMemberShowPaste
                                  ? `▾ ${t.pasteAgentIdAdvanced}`
                                  : `▸ ${t.pasteAgentIdAdvanced}`}
                              </button>
                              {addMemberShowPaste ? (
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                  <input
                                    value={addMemberId}
                                    onChange={(e) => setAddMemberId(e.target.value)}
                                    placeholder={t.agentIdPlaceholder}
                                    style={inputStyle}
                                  />
                                  <button
                                    type="button"
                                    style={btnPrimary}
                                    disabled={busy || !addMemberId.trim()}
                                    onClick={() => {
                                      const id = addMemberId.trim();
                                      if (id) void addCandidate(id);
                                    }}
                                  >
                                    {t.addMember}
                                  </button>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                      <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
                        <button
                          type="button"
                          style={{ ...btnGhost, width: "100%" }}
                          onClick={() => setShowAddMember(false)}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {confirmDialog ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => {
            if (!busy) setConfirmDialog(null);
          }}
        >
          <div
            style={{
              width: "min(340px, 100%)",
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 14,
                lineHeight: 1.5,
                color: colors.text,
              }}
            >
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={btnGhost}
                disabled={busy}
                onClick={() => setConfirmDialog(null)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                style={{
                  ...btnGhost,
                  background: "rgba(248,113,113,0.15)",
                  borderColor: "rgba(248,113,113,0.45)",
                  color: colors.danger,
                  fontWeight: 600,
                }}
                disabled={busy}
                onClick={() => confirmDialog.onConfirm()}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

const mentionRow: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: "10px 12px",
  border: "none",
  background: "transparent",
  color: colors.text,
  cursor: "pointer",
  textAlign: "left",
};
