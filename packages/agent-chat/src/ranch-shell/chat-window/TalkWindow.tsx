"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RanchMessages } from "../i18n";
import { studioOriginOf, talkHostSrc, type TalkWindowPayload } from "./types";

export function TalkWindow({
  chatId,
  studioBaseUrl,
  payload,
  t,
  onExpired,
}: {
  chatId: string;
  studioBaseUrl: string;
  payload: TalkWindowPayload;
  t: RanchMessages;
  onExpired?: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const targetOrigin = studioOriginOf(studioBaseUrl);
  const frameSrc = useMemo(
    () =>
      talkHostSrc({
        studioBaseUrl,
        hostPath: payload.hostPath,
        chatId,
        hostToken: payload.hostToken,
      }),
    // hostToken refresh is postMessage-only; changing src remounts the stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first token only
    [studioBaseUrl, payload.hostPath, chatId],
  );

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
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== targetOrigin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === "talk:expired") onExpired();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onExpired, targetOrigin]);

  return (
    <iframe
      ref={frameRef}
      title={payload.name || t.faceChat}
      src={frameSrc}
      allow="autoplay; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: "none",
        background: "#09090b",
      }}
    />
  );
}
