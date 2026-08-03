"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChatGatewayError, createGatewayClient } from "./gateway";
import type {
  AgentChatMode,
  AgentChatShellProps,
  ChatMessage,
  ChatOpenEventDetail,
  ChatSummary,
} from "./types";
import { CHAT_OPEN_EVENT } from "./types";
import { connectChatSocket, type ChatSocket } from "./ws";

const DEFAULT_ACCENT = "#10B981";
const ZINC_800 = "#27272a";
const ZINC_900 = "#18181b";
const ZINC_BORDER = "#27272a";

const shellPanelStyle = (mode: AgentChatMode, open: boolean): CSSProperties => {
  if (!open) return { display: "none" };
  if (mode === "full") {
    return {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#0b0f14",
      color: "#e8eef5",
      display: "flex",
      flexDirection: "column",
    };
  }
  return {
    position: "fixed",
    top: 0,
    right: 0,
    width: "min(420px, 100vw)",
    height: "100vh",
    zIndex: 9999,
    background: "#0b0f14",
    color: "#e8eef5",
    borderLeft: "1px solid #1f2a37",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
  };
};

/** ComicLaw Studio–like floating card (right-bottom). */
const assistantOuterStyle = (open: boolean): CSSProperties => {
  if (!open) return { display: "none" };
  return {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9999,
    display: "flex",
    justifyContent: "flex-end",
    pointerEvents: "none",
  };
};

const assistantCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 384,
  height: "70vh",
  maxHeight: 560,
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 16,
  border: `1px solid ${ZINC_BORDER}`,
  background: ZINC_900,
  color: "#f4f4f5",
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.55)",
};

/**
 * @deprecated Transition scaffold. Hosts with full chat UX should use {@link RanchChatShell}
 * (ranch list / conversation / new-chat chrome + Gateway). Kept for Labs `variant=assistant` float.
 */
export function AgentChatShell(props: AgentChatShellProps) {
  const {
    mode: modeProp = "side",
    variant = "shell",
    open: openProp,
    onOpenChange,
    getAccessToken,
    gatewayBaseUrl,
    defaultAgentIds = [],
    directoryAgents = [],
    allowAgentPicker: allowAgentPickerProp,
    allowGroupChat: allowGroupChatProp,
    showGatewayStatus: showGatewayStatusProp,
    context,
    onClose,
    title = "Agent Chat",
    hideLauncher = false,
    accentColor = DEFAULT_ACCENT,
    disclaimer,
  } = props;

  const isAssistant = variant === "assistant";
  const allowAgentPicker = isAssistant ? false : (allowAgentPickerProp ?? true);
  const allowGroupChat = isAssistant ? false : (allowGroupChatProp ?? true);
  const showGatewayStatus = isAssistant ? false : (showGatewayStatusProp ?? true);

  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<AgentChatMode>(modeProp);
  const open = openProp ?? internalOpen;
  const listRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setInternalOpen(next);
      if (!next) onClose?.();
    },
    [onOpenChange, onClose, openProp],
  );

  const client = useMemo(
    () => createGatewayClient(gatewayBaseUrl, getAccessToken),
    [gatewayBaseUrl, getAccessToken],
  );

  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState(defaultAgentIds[0] ?? "");
  const [chatKind, setChatKind] = useState<"direct" | "group">("direct");
  const [groupTitle, setGroupTitle] = useState("Agent group");
  const [groupAgents, setGroupAgents] = useState(
    defaultAgentIds.length ? defaultAgentIds.join(", ") : "",
  );
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed" | "error" | "idle">(
    "idle",
  );
  const socketRef = useRef<ChatSocket | null>(null);
  const autoOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    setMode(modeProp);
  }, [modeProp]);

  useEffect(() => {
    if (defaultAgentIds[0] && !agentId) setAgentId(defaultAgentIds[0]);
  }, [defaultAgentIds, agentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await client.health();
        if (!cancelled) {
          setHealthOk(h.ok);
          setHealthError(h.ok ? null : h.error ?? "unavailable");
        }
      } catch (e) {
        if (!cancelled) {
          setHealthOk(false);
          setHealthError(e instanceof Error ? e.message : "health failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ChatOpenEventDetail>).detail;
      if (detail?.mode) setMode(detail.mode);
      if (detail?.agentId && !isAssistant) setAgentId(detail.agentId);
      setOpen(true);
    };
    window.addEventListener(CHAT_OPEN_EVENT, handler);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, handler);
  }, [setOpen, isAssistant]);

  const loadMessages = useCallback(
    async (chatId: string) => {
      const list = await client.listMessages(chatId);
      setMessages(list);
    },
    [client],
  );

  const ensureChat = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (chatKind === "group" && allowGroupChat) {
        const ids = groupAgents
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (ids.length < 1) throw new Error("Need at least one agent id");
        const c = await client.createGroupChat(groupTitle.trim() || "Agent group", ids);
        setChat(c);
        await loadMessages(c.chat_id);
        return c;
      }
      const id = (agentId || defaultAgentIds[0] || "").trim();
      if (!id) throw new Error(isAssistant ? "官方助手暂未配置" : "Enter an agent id");
      const c = await client.createOrGetDirectChat(id);
      setChat(c);
      await loadMessages(c.chat_id);
      return c;
    } catch (e) {
      const msg =
        e instanceof ChatGatewayError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to open chat";
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, [
    agentId,
    allowGroupChat,
    chatKind,
    client,
    defaultAgentIds,
    groupAgents,
    groupTitle,
    isAssistant,
    loadMessages,
  ]);

  useEffect(() => {
    if (!isAssistant || !open || healthOk !== true) return;
    const id = (defaultAgentIds[0] || agentId || "").trim();
    if (!id) return;
    if (chat?.agent_id === id || autoOpenedRef.current === id) return;
    autoOpenedRef.current = id;
    void ensureChat();
  }, [isAssistant, open, healthOk, defaultAgentIds, agentId, chat?.agent_id, ensureChat]);

  useEffect(() => {
    if (!open || !chat?.chat_id) {
      socketRef.current?.close();
      socketRef.current = null;
      setWsStatus("idle");
      return;
    }

    let cancelled = false;
    const chatId = chat.chat_id;
    setWsStatus("connecting");

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
            };
            setMessages((prev) =>
              prev.some((x) => x.message_id === m.message_id) ? prev : [...prev, m],
            );
            return;
          }
          // After stream ends, reload so final content matches DB even if deltas were missed.
          if (ev.type === "message.stream_end") {
            void loadMessages(chatId);
          }
        },
        onStatus: (s) => {
          if (!cancelled) setWsStatus(s);
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
  }, [open, chat?.chat_id, gatewayBaseUrl, getAccessToken, loadMessages]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !chat) return;
    setBusy(true);
    setError(null);
    try {
      const ctxLine =
        context?.task_id || context?.board_id
          ? `\n\n[context task=${context.task_id ?? "-"} board=${context.board_id ?? "-"}]`
          : "";
      const mentions =
        chat.type === "group"
          ? groupAgents
              .split(/[,;\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 1)
          : undefined;
      // Canonical POST awaits agent delivery; refresh list so UI shows the reply
      // even if WS missed events.
      await client.sendMessage(chat.chat_id, text + ctxLine, mentions);
      setDraft("");
      await loadMessages(chat.chat_id);
    } catch (e) {
      const msg =
        e instanceof ChatGatewayError
          ? e.code === "agent_unreachable"
            ? isAssistant
              ? "助手暂时无法连接，请稍后再试"
              : "Agent unreachable (gateway is up)"
            : e.message
          : isAssistant
            ? "发送失败"
            : "Send failed";
      setError(msg);
      // Still refresh — user message may have landed before delivery failed.
      try {
        await loadMessages(chat.chat_id);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  };

  const showChrome = allowAgentPicker || allowGroupChat || showGatewayStatus;
  const assistantUnconfigured = isAssistant && !(defaultAgentIds[0] || agentId).trim();
  const inputDisabled = !chat || healthOk === false || busy;

  const launcher = !hideLauncher && !open && (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 9998,
        borderRadius: 999,
        border: `1px solid ${accentColor}55`,
        background: isAssistant ? ZINC_900 : "#10221f",
        color: accentColor,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      {title}
    </button>
  );

  if (isAssistant) {
    return (
      <>
        {launcher}
        <div style={assistantOuterStyle(open)} data-agent-chat-mode="side" data-variant="assistant">
          <div style={assistantCardStyle}>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: `1px solid ${ZINC_BORDER}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5" }}>{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                title="关闭"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: "none",
                  background: "transparent",
                  color: "#71717a",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </header>

            <div
              ref={listRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {healthOk === false && (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    background: "rgba(245, 158, 11, 0.1)",
                    color: "#fcd34d",
                    fontSize: 12,
                    padding: "8px 12px",
                  }}
                >
                  {healthError ?? "对话服务暂不可用"}
                </div>
              )}
              {assistantUnconfigured && (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    background: "rgba(245, 158, 11, 0.1)",
                    color: "#fcd34d",
                    fontSize: 12,
                    padding: "8px 12px",
                  }}
                >
                  官方助手暂未配置（NEXT_PUBLIC_LABS_CONCIERGE_AGENT_ID）
                </div>
              )}

              {messages.length === 0 && !assistantUnconfigured && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "85%",
                    borderRadius: 12,
                    background: "rgba(39, 39, 42, 0.6)",
                    color: "#d4d4d8",
                    fontSize: 14,
                    lineHeight: 1.5,
                    padding: "8px 12px",
                  }}
                >
                  {busy ? "正在连接助手…" : "你好，有什么可以帮你的？"}
                </div>
              )}

              {messages.map((m) => {
                const isUser = m.sender_type === "user";
                return (
                  <div
                    key={m.message_id}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "85%",
                        whiteSpace: "pre-wrap",
                        borderRadius: 12,
                        padding: "8px 12px",
                        fontSize: 14,
                        lineHeight: 1.55,
                        background: isUser ? accentColor : "rgba(39, 39, 42, 0.6)",
                        color: isUser ? "#09090b" : "#e4e4e7",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}

              {busy && messages.length > 0 && (
                <p style={{ margin: 0, padding: "0 4px", fontSize: 12, color: "#71717a" }}>
                  思考中…
                </p>
              )}

              {error && (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    background: "rgba(245, 158, 11, 0.1)",
                    color: "#fcd34d",
                    fontSize: 12,
                    padding: "8px 12px",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              style={{ borderTop: `1px solid ${ZINC_BORDER}`, padding: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={healthOk === false ? "服务暂不可用" : "输入消息…"}
                  disabled={inputDisabled}
                  style={{
                    minWidth: 0,
                    flex: 1,
                    borderRadius: 999,
                    border: "none",
                    background: ZINC_800,
                    color: "#f4f4f5",
                    padding: "8px 14px",
                    fontSize: 14,
                    outline: "none",
                    opacity: inputDisabled ? 0.6 : 1,
                  }}
                />
                <button
                  type="submit"
                  disabled={inputDisabled || !draft.trim()}
                  style={{
                    flexShrink: 0,
                    borderRadius: 999,
                    border: "none",
                    background: accentColor,
                    color: "#09090b",
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: inputDisabled || !draft.trim() ? "default" : "pointer",
                    opacity: inputDisabled || !draft.trim() ? 0.4 : 1,
                  }}
                >
                  发送
                </button>
              </div>
              {disclaimer && (
                <p
                  style={{
                    margin: "6px 4px 0",
                    fontSize: 11,
                    color: "#52525b",
                  }}
                >
                  {disclaimer}
                </p>
              )}
            </form>
          </div>
        </div>
      </>
    );
  }

  // ── shell variant (full-height side / full) ──────────────────────────
  return (
    <>
      {launcher}

      <div style={shellPanelStyle(mode, open)} data-agent-chat-mode={mode} data-variant="shell">
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid #1f2a37",
          }}
        >
          <strong style={{ flex: 1, fontSize: 14 }}>{title}</strong>
          <button
            type="button"
            onClick={() => setMode(mode === "side" ? "full" : "side")}
            style={btnGhost}
          >
            {mode === "side" ? "Full" : "Side"}
          </button>
          <button type="button" onClick={() => setOpen(false)} style={btnGhost}>
            Close
          </button>
        </header>

        {showChrome && (
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2a37", fontSize: 12 }}>
            {showGatewayStatus && (
              <>
                {healthOk === null && <span style={{ color: "#94a3b8" }}>Checking gateway…</span>}
                {healthOk === true && (
                  <span style={{ color: "#5eead4" }}>
                    Gateway ok
                    {wsStatus === "open"
                      ? " · live"
                      : wsStatus === "connecting"
                        ? " · connecting…"
                        : wsStatus === "error" || wsStatus === "closed"
                          ? " · offline push"
                          : ""}
                  </span>
                )}
                {healthOk === false && (
                  <span style={{ color: "#f87171" }}>{healthError ?? "Gateway down"}</span>
                )}
              </>
            )}
            {allowGroupChat && (
              <div
                style={{
                  marginTop: showGatewayStatus ? 8 : 0,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() => setChatKind("direct")}
                  style={{ ...btnGhost, opacity: chatKind === "direct" ? 1 : 0.55 }}
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => setChatKind("group")}
                  style={{ ...btnGhost, opacity: chatKind === "group" ? 1 : 0.55 }}
                >
                  Group
                </button>
              </div>
            )}
            {chatKind === "direct" || !allowGroupChat ? (
              allowAgentPicker ? (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  {(["mine", "recommended"] as const).map((group) => {
                    const rows = directoryAgents.filter((a) => a.group === group);
                    if (!rows.length) return null;
                    return (
                      <div key={group}>
                        <div style={{ color: "#94a3b8", marginBottom: 6, fontSize: 11 }}>
                          {group === "mine" ? "Your agents" : "Recommended"}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {rows.map((a) => (
                            <button
                              key={`${group}:${a.agent_id}`}
                              type="button"
                              disabled={busy}
                              title={a.description ?? a.agent_id}
                              onClick={() => {
                                setAgentId(a.agent_id);
                                void (async () => {
                                  setAgentId(a.agent_id);
                                  // ensureChat reads agentId from state — set then open on next tick
                                  setBusy(true);
                                  setError(null);
                                  try {
                                    const c = await client.createOrGetDirectChat(a.agent_id.trim());
                                    setChat(c);
                                    await loadMessages(c.chat_id);
                                  } catch (e) {
                                    setError(
                                      e instanceof ChatGatewayError
                                        ? e.message
                                        : e instanceof Error
                                          ? e.message
                                          : "Failed to open chat",
                                    );
                                  } finally {
                                    setBusy(false);
                                  }
                                })();
                              }}
                              style={{
                                ...btnGhost,
                                maxWidth: "100%",
                                textAlign: "left",
                                borderColor:
                                  agentId === a.agent_id ? "#2dd4bf" : btnGhost.borderColor,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>
                                {a.name?.trim() || a.agent_id}
                              </span>
                              {a.name?.trim() ? (
                                <span style={{ opacity: 0.55, marginLeft: 6, fontSize: 10 }}>
                                  {a.agent_id.length > 18
                                    ? `${a.agent_id.slice(0, 16)}…`
                                    : a.agent_id}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      placeholder="Or paste ACN agent id"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => void ensureChat()}
                      disabled={busy}
                      style={btnGhost}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ) : null
            ) : (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="Group title"
                  style={inputStyle}
                />
                <input
                  value={groupAgents}
                  onChange={(e) => setGroupAgents(e.target.value)}
                  placeholder="agent ids (comma-separated)"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => void ensureChat()}
                  disabled={busy}
                  style={btnGhost}
                >
                  Create group
                </button>
                <span style={{ color: "#64748b", fontSize: 11 }}>
                  Sends @ the first agent (no silent broadcast).
                </span>
              </div>
            )}
          </div>
        )}

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
              No messages yet. Say what you need — delivery uses Chat Gateway `/api/chats`.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.message_id}
              style={{
                alignSelf: m.sender_type === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                background: m.sender_type === "user" ? "#134e4a" : "#1e293b",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              <div style={{ opacity: 0.55, fontSize: 11, marginBottom: 4 }}>
                {m.sender_type}:{m.sender_id.slice(0, 24)}
              </div>
              {m.content}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: "8px 14px", color: "#f87171", fontSize: 12 }}>{error}</div>
        )}

        <footer style={{ padding: 12, borderTop: "1px solid #1f2a37", display: "flex", gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={healthOk === false ? "Gateway unavailable" : "Message…"}
            disabled={inputDisabled}
            style={{ ...inputStyle, resize: "none", flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={inputDisabled || !draft.trim()}
            style={{
              ...btnGhost,
              background: "#134e4a",
              color: "#ccfbf1",
              alignSelf: "flex-end",
            }}
          >
            Send
          </button>
        </footer>
      </div>
    </>
  );
}

const btnGhost: CSSProperties = {
  border: "1px solid #334155",
  background: "transparent",
  color: "#cbd5e1",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
};

/** Host helper: dispatch open event. */
export function openAgentChat(detail?: ChatOpenEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: detail ?? {} }));
}
