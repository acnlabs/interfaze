"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatGatewayError,
  connectChatSocket,
  createGatewayClient,
  type ChatMessage,
} from "@acnlabs/agent-chat";
import { getGatewayBaseUrl } from "@/lib/gateway";
import {
  EMBED_ERROR,
  EMBED_INIT,
  EMBED_READY,
  EMBED_RESIZE,
  postToParent,
} from "@/lib/embedProtocol";
import { originOf, stripQueryTokenFromUrl, tokenFromLocation } from "@/lib/embedToken";

type SessionMe = {
  chat_id: string;
  agent_id: string;
  parent_origin: string | null;
  metadata?: Record<string, unknown>;
};

type Props = {
  locale?: string | null;
  theme?: string | null;
};

const copy = {
  en: {
    placeholder: "Message…",
    send: "Send",
    empty: "Say something to start.",
    missing: "Missing embed token.",
    loadFailed: "Could not open this chat.",
  },
  zh: {
    placeholder: "输入消息…",
    send: "发送",
    empty: "说一句，开始这一站。",
    missing: "缺少 embed token。",
    loadFailed: "打不开这场对话。",
  },
};

export default function InterfazeEmbedHost({ locale, theme }: Props) {
  const zh = (locale || "").toLowerCase().startsWith("zh");
  const t = zh ? copy.zh : copy.en;
  const gatewayBaseUrl = getGatewayBaseUrl();
  const dark = theme !== "light";

  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<SessionMe | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const parentOriginRef = useRef<string>("");
  const allowedOriginsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const existing = tokenFromLocation(window.location.search, window.location.hash);
    const gateway = getGatewayBaseUrl().replace(/\/+$/, "");

    const loadConfig = async () => {
      try {
        const res = await fetch(`${gateway}/api/chat/embed/config`);
        const data = (await res.json().catch(() => null)) as { allowed_origins?: string[] } | null;
        if (!cancelled && Array.isArray(data?.allowed_origins)) {
          allowedOriginsRef.current = data.allowed_origins;
        }
      } catch {
        /* session parent_origin is still used if config is unreachable */
      }
    };

    void loadConfig();
    if (existing) {
      stripQueryTokenFromUrl();
      setToken(existing);
      return () => {
        cancelled = true;
      };
    }

    const onMsg = (ev: MessageEvent) => {
      if (!ev.data || ev.data.type !== EMBED_INIT) return;
      const next = typeof ev.data.token === "string" ? ev.data.token.trim() : "";
      if (!next) return;
      const allowed = allowedOriginsRef.current;
      if (allowed.length > 0 && !allowed.includes(ev.origin)) return;
      setToken(next);
    };
    window.addEventListener("message", onMsg);
    const timer = window.setTimeout(() => {
      if (!cancelled) setToken((prev) => prev ?? "");
    }, 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMsg);
    };
  }, []);

  const getAccessToken = useCallback(async () => token || null, [token]);
  const client = useMemo(
    () => createGatewayClient(gatewayBaseUrl, getAccessToken),
    [gatewayBaseUrl, getAccessToken],
  );

  const notifyError = useCallback((code: string, message: string) => {
    setError(message);
    postToParent({ type: EMBED_ERROR, code, message }, parentOriginRef.current);
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      notifyError("embed_token_invalid", t.missing);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${gatewayBaseUrl.replace(/\/+$/, "")}/api/chat/embed/sessions/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => null)) as
          | (SessionMe & { detail?: { code?: string; message?: string } })
          | null;
        if (!res.ok) {
          const code = data?.detail?.code || "embed_token_invalid";
          const message = data?.detail?.message || t.loadFailed;
          if (!cancelled) notifyError(code, message);
          return;
        }
        if (!data?.chat_id) {
          if (!cancelled) notifyError("embed_token_invalid", t.loadFailed);
          return;
        }
        const fromSession = (data.parent_origin || "").trim();
        const fromReferrer = originOf(document.referrer);
        const allowed = allowedOriginsRef.current;
        if (fromSession && (allowed.length === 0 || allowed.includes(fromSession))) {
          parentOriginRef.current = fromSession;
        } else if (fromReferrer && (allowed.length === 0 || allowed.includes(fromReferrer))) {
          parentOriginRef.current = fromReferrer;
        } else {
          parentOriginRef.current = "";
        }
        const list = await client.listMessages(data.chat_id);
        if (cancelled) return;
        setSession(data);
        setMessages(list);
        const height = document.documentElement.scrollHeight || 480;
        postToParent(
          {
            type: EMBED_READY,
            height,
            chatId: data.chat_id,
            agentId: data.agent_id,
          },
          parentOriginRef.current,
        );
      } catch (e) {
        if (!cancelled) {
          notifyError("embed_unavailable", e instanceof Error ? e.message : t.loadFailed);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, gatewayBaseUrl, notifyError, t.loadFailed, t.missing, token]);

  useEffect(() => {
    if (!session?.chat_id || !token) return;
    const chatId = session.chat_id;
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
            created_at: typeof d.created_at === "string" ? d.created_at : new Date().toISOString(),
          };
          setMessages((prev) =>
            prev.some((x) => x.message_id === m.message_id) ? prev : [...prev, m],
          );
        }
        if (ev.type === "message.stream_end") {
          void client.listMessages(chatId).then(setMessages).catch(() => undefined);
        }
      },
    });
    sock.subscribe(chatId);
    return () => sock.close();
  }, [client, gatewayBaseUrl, session?.chat_id, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    const height = document.documentElement.scrollHeight || 480;
    postToParent({ type: EMBED_RESIZE, height }, parentOriginRef.current);
  }, [messages, error]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !session || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.sendMessage(session.chat_id, text);
      setDraft("");
      setMessages(await client.listMessages(session.chat_id));
    } catch (e) {
      if (e instanceof ChatGatewayError) {
        notifyError(e.code || "send_failed", e.message);
      } else {
        notifyError("send_failed", e instanceof Error ? e.message : "Send failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-theme={dark ? "dark" : "light"}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "100dvh",
        background: dark ? "var(--bg)" : "#fafafa",
        color: dark ? "var(--fg)" : "#18181b",
      }}
    >
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 16px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 && !error ? (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "24px 0" }}>{t.empty}</p>
        ) : null}
        {messages.map((m) => {
          const mine = m.sender_type === "user";
          return (
            <div
              key={m.message_id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "85%",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 14,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                background: mine ? "var(--accent)" : dark ? "#18181b" : "#e4e4e7",
                color: mine ? "#052e16" : undefined,
                border: mine ? "none" : "1px solid var(--border)",
              }}
            >
              {m.content}
            </div>
          );
        })}
      </div>
      {error ? (
        <p style={{ margin: "0 16px 8px", color: "#f87171", fontSize: 12 }}>{error}</p>
      ) : null}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void send();
        }}
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.placeholder}
          disabled={!session || busy}
          style={{
            flex: 1,
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: dark ? "#18181b" : "#fff",
            color: "inherit",
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!session || busy || !draft.trim()}
          style={{
            borderRadius: 999,
            border: "none",
            background: "var(--accent)",
            color: "#052e16",
            fontWeight: 600,
            padding: "10px 16px",
            cursor: "pointer",
            opacity: !session || busy || !draft.trim() ? 0.5 : 1,
          }}
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
