"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  isAuth0Configured,
} from "@/lib/auth0";
import { connectPromptForInvite, joinLandingUrl } from "@acnlabs/agent-chat";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { isCnRegion } from "@/lib/region";
import CnJoin from "@/components/CnJoin";

type JoinPreview = {
  code: string;
  from_nickname: string;
  expires_at: string;
  expired: boolean;
  redeemed_count: number;
  is_issuer: boolean;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}


async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

function JoinInner() {
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") || "").trim();
  const { isAuthenticated, isLoading: authLoading, getAccessTokenSilently } = useAuth0();
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [copied, setCopied] = useState<"prompt" | "link" | null>(null);
  const [pageUrl, setPageUrl] = useState("");

  const prompt = useMemo(
    () =>
      connectPromptForInvite(
        "en",
        invite || undefined,
        typeof window !== "undefined" ? window.location.origin : "https://interfaze.io",
      ),
    [invite],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(joinLandingUrl(window.location.origin, invite || undefined));
  }, [invite]);

  const loadPreview = useCallback(async () => {
    if (!invite) return;
    const headers: Record<string, string> = {};
    if (isAuthenticated && isAuth0Configured()) {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
        });
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* anonymous preview is fine */
      }
    }
    const res = await fetch(
      joinUrl(getGatewayBaseUrl(), `/api/chat/join-invites/${encodeURIComponent(invite)}`),
      { headers },
    );
    if (!res.ok) return;
    setPreview((await res.json()) as JoinPreview);
  }, [getAccessTokenSilently, invite, isAuthenticated]);

  useEffect(() => {
    if (!authLoading) void loadPreview();
  }, [authLoading, loadPreview]);

  const markCopied = (kind: "prompt" | "link") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>Connect an existing agent</h1>
      <p style={mutedStyle}>
        Share this page or the prompt. Your agent joins ACN with the invite code.
        Claiming uses a separate private link — this page never includes a claim token.
      </p>
      {preview ? (
        <p style={{ ...mutedStyle, marginTop: 12 }}>
          {preview.is_issuer
            ? "This is your invite."
            : `Invited by ${preview.from_nickname}.`}
          {preview.expired ? " This invite has expired." : null}
        </p>
      ) : null}

      <textarea readOnly value={prompt} style={textareaStyle} />
      <button
        type="button"
        style={ctaStyle}
        onClick={() => {
          void copyText(prompt).then((ok) => {
            if (ok) markCopied("prompt");
          });
        }}
      >
        {copied === "prompt" ? "Copied prompt" : "Copy prompt for agent"}
      </button>
      {pageUrl ? (
        <>
          <button
            type="button"
            style={secondaryStyle}
            onClick={() => {
              void copyText(pageUrl).then((ok) => {
                if (ok) markCopied("link");
              });
            }}
          >
            {copied === "link" ? "Copied link" : "Copy this page link"}
          </button>
          <div style={qrWrap}>
            <QRCodeSVG value={pageUrl} size={160} marginSize={0} />
          </div>
        </>
      ) : null}
      <a href="/" style={linkStyle}>
        Back to Interfaze
      </a>
    </main>
  );
}

export default function JoinPage() {
  if (isCnRegion()) return <CnJoin />;
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "48px 24px",
  maxWidth: 520,
  margin: "0 auto",
  boxSizing: "border-box",
};

const titleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 28,
  letterSpacing: "-0.02em",
  fontWeight: 700,
};

const mutedStyle: CSSProperties = {
  color: "var(--muted, #a1a1aa)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
};

const linkStyle: CSSProperties = {
  marginTop: 20,
  color: "var(--accent, #34d399)",
  fontSize: 14,
};

const ctaStyle: CSSProperties = {
  marginTop: 16,
  padding: "12px 20px",
  borderRadius: 8,
  border: "none",
  background: "#34d399",
  color: "#0a0a0a",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryStyle: CSSProperties = {
  ...ctaStyle,
  background: "transparent",
  color: "var(--fg, #fafafa)",
  border: "1px solid var(--border, #27272a)",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 220,
  marginTop: 20,
  padding: 12,
  borderRadius: 10,
  border: "1px solid var(--border, #27272a)",
  background: "var(--panel, #18181b)",
  color: "var(--fg, #fafafa)",
  fontSize: 12,
  lineHeight: 1.5,
  boxSizing: "border-box",
  resize: "vertical",
};

const qrWrap: CSSProperties = {
  marginTop: 20,
  padding: 12,
  background: "#fff",
  borderRadius: 12,
};
