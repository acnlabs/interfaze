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
import Loading from "@/components/Loading";
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

type JoinAuth = {
  isAuthenticated: boolean;
  authLoading: boolean;
  getAccessTokenSilently?: ReturnType<typeof useAuth0>["getAccessTokenSilently"];
};

function JoinView({ auth }: { auth: JoinAuth }) {
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") || "").trim();
  const { isAuthenticated, authLoading, getAccessTokenSilently } = auth;
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
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
    setPreviewError(false);
    const headers: Record<string, string> = {};
    if (isAuthenticated && getAccessTokenSilently) {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
        });
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* anonymous preview is fine */
      }
    }
    try {
      const res = await fetch(
        joinUrl(getGatewayBaseUrl(), `/api/chat/join-invites/${encodeURIComponent(invite)}`),
        { headers },
      );
      if (!res.ok) {
        setPreviewError(true);
        return;
      }
      setPreview((await res.json()) as JoinPreview);
    } catch {
      setPreviewError(true);
    }
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
        Share this page or the prompt so your agent can join with the invite code.
        Ownership stays with you — this page never includes ownership credentials.
      </p>
      {!invite ? (
        <>
          <p
            style={{
              ...mutedStyle,
              marginTop: 16,
              padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            This link is missing an invite code. Open a chat on Interfaze and ask your
            agent to create a join invite, then share the link it gives you.
          </p>
          <a href="/" style={{ ...ctaStyle, textAlign: "center", textDecoration: "none" }}>
            Open Interfaze
          </a>
        </>
      ) : (
        <>
      {previewError ? (
        <p style={{ ...mutedStyle, marginTop: 12, color: "var(--danger)" }}>
          Couldn't load the invite preview.{" "}
          <button
            type="button"
            onClick={() => void loadPreview()}
            style={{ ...secondaryStyle, padding: "4px 12px", fontSize: 12, marginLeft: 4 }}
          >
            Retry
          </button>
        </p>
      ) : null}
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
        style={{
          ...ctaStyle,
          ...(preview?.expired ? { opacity: 0.5, cursor: "not-allowed" } : null),
        }}
        disabled={preview?.expired}
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
            style={{
              ...secondaryStyle,
              ...(preview?.expired ? { opacity: 0.5, cursor: "not-allowed" } : null),
            }}
            disabled={preview?.expired}
            onClick={() => {
              void copyText(pageUrl).then((ok) => {
                if (ok) markCopied("link");
              });
            }}
          >
            {copied === "link" ? "Copied link" : "Copy this page link"}
          </button>
          <div style={qrWrap}>
            <QRCodeSVG value={pageUrl} size={160} marginSize={2} />
          </div>
        </>
      ) : null}
        </>
      )}
      <a href="/" style={linkStyle}>
        Back to Interfaze
      </a>
    </main>
  );
}

function JoinAuthed() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  return (
    <JoinView auth={{ isAuthenticated, authLoading: isLoading, getAccessTokenSilently }} />
  );
}

function JoinGate() {
  // Without Auth0 the page still works anonymously — prompt / QR / copy need no login.
  if (!isAuth0Configured()) {
    return <JoinView auth={{ isAuthenticated: false, authLoading: false }} />;
  }
  return <JoinAuthed />;
}

export default function JoinPage() {
  if (isCnRegion()) return <CnJoin />;
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <Loading label="Loading…" style={{ color: "var(--muted)" }} />
        </main>
      }
    >
      <JoinGate />
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
  background: "var(--success)",
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
