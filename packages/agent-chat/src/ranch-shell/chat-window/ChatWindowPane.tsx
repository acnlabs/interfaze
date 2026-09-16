"use client";

import type { RanchMessages } from "../i18n";
import { btnGhost, colors } from "../styles";
import { TalkWindow } from "./TalkWindow";
import type { ChatWindow } from "./types";

export function ChatWindowPane({
  window,
  studioBaseUrl,
  onClose,
  t,
}: {
  window: ChatWindow;
  studioBaseUrl: string;
  onClose: () => void;
  t: RanchMessages;
}) {
  const title =
    window.title ||
    (window.kind === "body"
      ? window.payload.name || t.bodyChat
      : window.payload.name || t.faceChat);

  return (
    <aside
      data-chat-window={window.kind}
      data-chat-window-id={window.chatId}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 420px",
        minWidth: 280,
        maxWidth: 640,
        height: "100%",
        borderLeft: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <div
        style={{
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <strong
          style={{
            fontSize: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </strong>
        <button type="button" style={btnGhost} onClick={onClose} aria-label={t.windowClose}>
          {t.close}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {window.kind === "talk" || window.kind === "body" ? (
          <TalkWindow
            chatId={window.chatId}
            studioBaseUrl={studioBaseUrl}
            payload={window.payload}
            kind={window.kind}
            t={t}
          />
        ) : null}
      </div>
    </aside>
  );
}
