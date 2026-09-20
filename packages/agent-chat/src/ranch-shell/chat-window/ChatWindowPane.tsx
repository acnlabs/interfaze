"use client";

import type { RanchMessages } from "../i18n";
import { btnGhost, colors } from "../styles";
import { TalkWindow } from "./TalkWindow";
import type { ChatWindow } from "./types";

export function ChatWindowPane({
  window,
  studioBaseUrl,
  busy,
  onClose,
  onTalkExpired,
  t,
}: {
  window: ChatWindow | null;
  studioBaseUrl: string;
  busy?: boolean;
  onClose: () => void;
  onTalkExpired?: () => void;
  t: RanchMessages;
}) {
  const empty = !window;
  const title =
    window?.title ||
    (window?.kind === "talk" ? window.payload.name || t.faceChat : t.showWindow);

  return (
    <aside
      data-chat-window={window?.kind || (busy ? "opening" : "empty")}
      data-chat-window-id={window?.chatId || ""}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: empty ? "0 0 240px" : "1 1 420px",
        minWidth: empty ? 200 : 280,
        maxWidth: empty ? 280 : 640,
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
        <button type="button" style={btnGhost} onClick={onClose} aria-label={t.hideWindow}>
          {t.close}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {window?.kind === "talk" ? (
          <TalkWindow
            chatId={window.chatId}
            studioBaseUrl={studioBaseUrl}
            payload={window.payload}
            t={t}
            onExpired={onTalkExpired}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              color: colors.muted,
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            {busy ? t.faceChatOpening : t.windowEmpty}
          </div>
        )}
      </div>
    </aside>
  );
}
