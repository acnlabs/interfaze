"use client";

import { useEffect, useState } from "react";
import type { GatewayClient } from "./gateway";
import type { ChatSummary } from "./types";
import { colors } from "./ranch-shell/styles";
import type { HistoryFilePreview } from "./HistoryChatThumbs";
import { HistoryChatThumbs } from "./HistoryChatThumbs";

export function HistoryFilesPanel({
  chats,
  labelFor,
  client,
  gatewayBaseUrl,
  getAccessToken,
  emptyLabel,
  loadingLabel,
  failedLabel = "Could not load attachments. Please retry.",
  retryLabel = "Retry",
  onPick,
}: {
  chats: ChatSummary[];
  labelFor: (chat: ChatSummary) => string;
  client: GatewayClient;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  emptyLabel: string;
  loadingLabel: string;
  failedLabel?: string;
  retryLabel?: string;
  onPick: (chat: ChatSummary, mailboxId: string) => void;
}) {
  const [byChat, setByChat] = useState<Record<string, HistoryFilePreview[]>>({});
  const [loading, setLoading] = useState(true);
  const [failedChats, setFailedChats] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  const chatKey = chats.map((c) => c.chat_id).join("|");
  useEffect(() => {
    if (chats.length === 0) {
      setByChat({});
      setFailedChats([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailedChats([]);
    (async () => {
      const next: Record<string, HistoryFilePreview[]> = {};
      const failed: string[] = [];
      for (const chat of chats) {
        if (cancelled) return;
        try {
          next[chat.chat_id] = await client.listChatFiles(chat.chat_id);
        } catch {
          failed.push(chat.chat_id);
        }
      }
      if (!cancelled) {
        setByChat(next);
        setFailedChats(failed);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatKey, client, retryCount]);

  const groups = chats
    .map((chat) => ({ chat, files: byChat[chat.chat_id] || [] }))
    .filter((g) => g.files.length > 0);

  if (loading && groups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", color: colors.muted, fontSize: 12 }}>
        {loadingLabel}
      </div>
    );
  }
  if (!loading && groups.length === 0 && failedChats.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", color: colors.muted }}>
        <p style={{ margin: 0, fontSize: 12 }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {failedChats.length > 0 ? (
        <div role="alert" style={{ fontSize: 13, color: colors.muted }}>
          <p>{failedLabel}</p>
          <div style={{ overflowWrap: "anywhere", marginBottom: 8 }}>
            {chats.filter((chat) => failedChats.includes(chat.chat_id)).map(labelFor).join(" · ")}
          </div>
          <button type="button" disabled={loading} onClick={() => setRetryCount((n) => n + 1)}
            style={{ minHeight: 44, padding: "8px 14px", borderRadius: 8, color: "inherit", border: `1px solid ${colors.border}`, background: "transparent", cursor: "pointer" }}>
            {retryLabel}
          </button>
        </div>
      ) : null}
      {groups.map(({ chat, files }) => (
        <section key={chat.chat_id}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 650,
              color: colors.text,
              marginBottom: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {labelFor(chat)}
          </div>
          <HistoryChatThumbs
            chatId={chat.chat_id}
            files={files}
            gatewayBaseUrl={gatewayBaseUrl}
            getAccessToken={getAccessToken}
            thumbSize={72}
            compact
            onPick={(mailboxId, event) => {
              event.stopPropagation();
              onPick(chat, mailboxId);
            }}
          />
        </section>
      ))}
    </div>
  );
}
