"use client";

import type { RanchMessages } from "../i18n";
import { btnGhost, colors } from "../styles";
import { TalkWindow } from "./TalkWindow";
import type { BodyPickItem, ChatWindow } from "./types";

function originLabel(origin: string | undefined, t: RanchMessages): string {
  if (origin === "robot") return t.bodyChatRobot;
  if (origin === "sim") return t.bodyChatSim;
  return origin?.trim() || "";
}

function BodyPickList({
  bodies,
  busy,
  onPick,
  t,
}: {
  bodies: BodyPickItem[];
  busy?: boolean;
  onPick?: (bodyId: string) => void;
  t: RanchMessages;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {bodies.map((body) => {
        const origin = originLabel(body.origin, t);
        return (
          <button
            key={body.id}
            type="button"
            disabled={busy}
            onClick={() => onPick?.(body.id)}
            style={{
              ...btnGhost,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              background: colors.panel,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {body.name}
              </strong>
              {origin ? (
                <span style={{ display: "block", fontSize: 11, color: colors.muted, marginTop: 2 }}>
                  {origin}
                </span>
              ) : null}
            </span>
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                color: body.live ? colors.recommended : colors.muted,
              }}
            >
              {body.live ? t.bodyChatLive : t.bodyChatOff}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ChatWindowPane({
  window,
  studioBaseUrl,
  onClose,
  onPickBody,
  onExpired,
  busy,
  t,
}: {
  window: ChatWindow;
  studioBaseUrl: string;
  onClose: () => void;
  onPickBody?: (bodyId: string) => void;
  onExpired?: () => void;
  busy?: boolean;
  t: RanchMessages;
}) {
  const title =
    window.title ||
    (window.kind === "body-pick"
      ? t.bodyChatPick
      : window.kind === "body"
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
      {window.kind === "body-pick" ? (
        <BodyPickList bodies={window.bodies} busy={busy} onPick={onPickBody} t={t} />
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <TalkWindow
            chatId={window.chatId}
            studioBaseUrl={studioBaseUrl}
            payload={window.payload}
            kind={window.kind}
            onExpired={onExpired}
            t={t}
          />
        </div>
      )}
    </aside>
  );
}
