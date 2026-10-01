"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RanchMessages } from "../i18n";
import { studioOriginOf, talkHostSrc, type TalkWindowPayload } from "./types";

export function TalkWindow({
  chatId,
  studioBaseUrl,
  payload,
  kind = "talk",
  onExpired,
  t,
}: {
  chatId: string;
  studioBaseUrl: string;
  payload: TalkWindowPayload;
  kind?: "talk" | "body";
  onExpired?: () => void;
  t: RanchMessages;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const src = useMemo(
    () =>
      talkHostSrc({
        studioBaseUrl,
        hostPath: payload.hostPath,
        chatId,
        hostToken: payload.hostToken,
      }),
    [studioBaseUrl, payload.hostPath, chatId],
  );
  const targetOrigin = studioOriginOf(studioBaseUrl);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !targetOrigin || !payload.hostToken) return;
    const send = () => {
      frame.contentWindow?.postMessage(
        { type: "talk:session", chatId, hostToken: payload.hostToken },
        targetOrigin,
      );
    };
    send();
    frame.addEventListener("load", send);
    return () => frame.removeEventListener("load", send);
  }, [chatId, payload.hostToken, targetOrigin]);

  useEffect(() => {
    if (!targetOrigin || !onExpired) return;
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== targetOrigin) return;
      const data = ev.data as { type?: string; chatId?: string };
      if (data?.type !== "talk:expired") return;
      if (typeof data.chatId === "string" && data.chatId && data.chatId !== chatId) return;
      onExpired();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [chatId, onExpired, targetOrigin]);

  return (
    <iframe
      ref={frameRef}
      title={payload.name || (kind === "body" ? t.bodyChat : t.faceChat)}
      src={src}
      allow="autoplay; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: "none",
        background: kind === "body" ? "#f4f1ea" : "#09090b",
      }}
    />
  );
}
