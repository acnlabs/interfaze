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
  onPick,
}: {
  chats: ChatSummary[];
  labelFor: (chat: ChatSummary) => string;
  client: GatewayClient;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  emptyLabel: string;
  loadingLabel: string;
  onPick: (chat: ChatSummary, mailboxId: string) => void;
}) {
  const [byChat, setByChat] = useState<Record<string, HistoryFilePreview[]>>({});
  const [loading, setLoading] = useState(false);

  const chatKey = chats.map((c) => c.chat_id).join("|");
  useEffect(() => {
    if (chats.length === 0) {
      setByChat({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const next: Record<string, HistoryFilePreview[]> = {};
      for (const chat of chats) {
        if (cancelled) return;
        try {
          next[chat.chat_id] = await client.listChatFiles(chat.chat_id);
        } catch {
          next[chat.chat_id] = [];
        }
      }
      if (!cancelled) {
        setByChat(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatKey, client]);

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
  if (!loading && groups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", color: colors.muted }}>
        <p style={{ margin: 0, fontSize: 12 }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
