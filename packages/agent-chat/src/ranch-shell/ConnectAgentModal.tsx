"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  connectPromptForInvite,
  copyText,
  joinLandingUrl,
} from "./connectPrompt";
import type { RanchLocale, RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors, inputStyle } from "./styles";

type Props = {
  locale: RanchLocale;
  messages: RanchMessages;
  interfazeBaseUrl?: string;
  createJoinInvite: () => Promise<{ code: string }>;
  onClose: () => void;
};

export function ConnectAgentModal({
  locale,
  messages: t,
  interfazeBaseUrl,
  createJoinInvite,
  onClose,
}: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<"prompt" | "link" | null>(null);

  const origin = useMemo(() => {
    const fromProp = (interfazeBaseUrl || "").replace(/\/+$/, "");
    if (fromProp) return fromProp;
    if (typeof window !== "undefined") return window.location.origin;
    return "https://interfaze.io";
  }, [interfazeBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    void createJoinInvite()
      .then(({ code: next }) => {
        if (cancelled) return;
        const trimmed = (next || "").trim();
        if (!trimmed) {
          setFailed(true);
          return;
        }
        setCode(trimmed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Invite once per open. Parent passes a fresh lambda each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const prompt = connectPromptForInvite(locale, code, origin);
  const pageUrl = joinLandingUrl(origin, code);

  const markCopied = (kind: "prompt" | "link") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.connectExisting}
      style={overlay}
      onClick={onClose}
    >
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <strong style={{ fontSize: 16 }}>{t.connectExisting}</strong>
          <button type="button" onClick={onClose} style={btnGhost} aria-label={t.close}>
            ✕
          </button>
        </div>
        <div style={body}>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: colors.muted }}>
            {t.connectHint}
          </p>
          {loading ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>{t.loading}</p>
          ) : failed || !code ? (
            <p style={{ margin: 0, color: colors.danger, fontSize: 13 }}>{t.connectInviteFailed}</p>
          ) : (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: colors.muted }}>
                {t.connectYourInvite}
              </p>
              <textarea readOnly value={prompt} style={promptBox} />
              <button
                type="button"
                style={{ ...btnPrimary, width: "100%" }}
                onClick={() => {
                  void copyText(prompt).then((ok) => {
                    if (ok) markCopied("prompt");
                  });
                }}
              >
                {copied === "prompt" ? t.promptCopied : t.copyPromptForAgent}
              </button>
              <button
                type="button"
                style={{ ...btnGhost, width: "100%" }}
                onClick={() => {
                  void copyText(pageUrl).then((ok) => {
                    if (ok) markCopied("link");
                  });
                }}
              >
                {copied === "link" ? t.promptCopied : t.copyPageLink}
              </button>
              <div style={qrWrap}>
                <QRCodeSVG value={pageUrl} size={160} marginSize={0} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 80,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(440px, 100%)",
  maxHeight: "85%",
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 25px 50px rgba(0,0,0,0.45)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: `1px solid ${colors.border}`,
  flexShrink: 0,
};

const body: CSSProperties = {
  overflow: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const promptBox: CSSProperties = {
  ...inputStyle,
  minHeight: 140,
  resize: "vertical",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 11,
  lineHeight: 1.45,
  color: colors.text,
};

const qrWrap: CSSProperties = {
  alignSelf: "center",
  marginTop: 4,
  padding: 10,
  background: "#fff",
  borderRadius: 12,
};
