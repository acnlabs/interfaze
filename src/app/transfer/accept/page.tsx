"use client";

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  isAuth0Configured,
} from "@/lib/auth0";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { isCnRegion } from "@/lib/region";
import CnTransferAccept from "@/components/CnTransferAccept";

type InvitePreview = {
  agent: { name: string; description: string | null; status: string };
  from_nickname: string;
  expires_at: string;
  expired: boolean;
  consumed: boolean;
  agent_id: string;
};

type AcceptResult = {
  success: boolean;
  agent_id: string;
  api_key?: string | null;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: { message?: string; code?: string } | string;
      message?: string;
    };
    if (typeof body.detail === "string") return body.detail;
    if (body.detail && typeof body.detail === "object" && body.detail.message) {
      return body.detail.message;
    }
    if (body.message) return body.message;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

function TransferAcceptInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    if (!inviteToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          joinUrl(getGatewayBaseUrl(), `/api/chat/transfer-invites/${encodeURIComponent(inviteToken)}`),
        );
        if (!res.ok) throw new Error(await parseError(res));
        const data = (await res.json()) as InvitePreview;
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError("This invite link is invalid or has expired.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const handleLogin = () => {
    if (!isAuth0Configured()) return;
    const returnTo =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/transfer/accept";
    void loginWithRedirect({
      appState: { returnTo },
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPE,
      },
    });
  };

  const handleAccept = useCallback(async () => {
    if (!inviteToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
      });
      const res = await fetch(
        joinUrl(
          getGatewayBaseUrl(),
          `/api/chat/transfer-invites/${encodeURIComponent(inviteToken)}/accept`,
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: "{}",
        },
      );
      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as AcceptResult;
      setAccepted(true);
      if (typeof data.api_key === "string" && data.api_key.trim()) {
        setApiKey(data.api_key);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not accept this gift.");
    } finally {
      setSubmitting(false);
    }
  }, [getAccessTokenSilently, inviteToken]);

  const copyKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setKeyCopied(true);
      window.setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading || authLoading) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  if (!inviteToken) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Invalid invite</h1>
        <p style={mutedStyle}>This link is missing an invite token.</p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  if (error && !preview) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Invite unavailable</h1>
        <p style={mutedStyle}>{error}</p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  if (preview?.consumed || preview?.expired) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>
          {preview.consumed ? "Already claimed" : "Invite expired"}
        </h1>
        <p style={mutedStyle}>
          {preview.consumed
            ? "Someone already accepted this gift."
            : "Ask the owner to create a new gift link."}
        </p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  if (accepted && preview) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>You’re the new owner</h1>
        <p style={mutedStyle}>
          <strong style={{ color: "var(--fg, #fafafa)" }}>{preview.agent.name}</strong>{" "}
          is now yours on Interfaze.
        </p>
        {apiKey ? (
          <div style={cardStyle}>
            <p style={{ ...mutedStyle, marginBottom: 8 }}>
              New API key (shown once — previous key is invalid):
            </p>
            <code style={keyBoxStyle}>{apiKey}</code>
            <button type="button" onClick={() => void copyKey()} style={secondaryBtnStyle}>
              {keyCopied ? "Copied" : "Copy key"}
            </button>
          </div>
        ) : null}
        <button type="button" style={ctaStyle} onClick={() => router.replace("/")}>
          Open Interfaze
        </button>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Accept a gift</h1>
        <p style={mutedStyle}>
          {preview?.from_nickname ?? "A friend"} wants to gift you{" "}
          <strong style={{ color: "var(--fg, #fafafa)" }}>
            {preview?.agent.name ?? "an agent"}
          </strong>
          . Sign in to accept ownership.
        </p>
        {preview?.agent.description ? (
          <p style={{ ...mutedStyle, marginTop: 8 }}>{preview.agent.description}</p>
        ) : null}
        <button type="button" onClick={handleLogin} style={ctaStyle}>
          Log in to accept
        </button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>Accept ownership</h1>
      {preview ? (
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{preview.agent.name}</h2>
          {preview.agent.description ? (
            <p style={{ ...mutedStyle, marginBottom: 10 }}>{preview.agent.description}</p>
          ) : null}
          <p style={{ ...mutedStyle, fontSize: 12, margin: 0 }}>
            From {preview.from_nickname} · expires{" "}
            {new Date(preview.expires_at).toLocaleString()}
          </p>
        </div>
      ) : null}
      <p style={{ color: "#d97706", fontSize: 13, lineHeight: 1.45, margin: "0 0 16px" }}>
        Accepting transfers ACN ownership to your account. The previous owner loses
        control; autonomous agents may receive a new API key.
      </p>
      {error ? (
        <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleAccept()}
        disabled={submitting}
        style={{ ...ctaStyle, opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? "Accepting…" : "Accept gift"}
      </button>
    </main>
  );
}

export default function TransferAcceptPage() {
  if (isCnRegion()) return <CnTransferAccept />;
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </main>
      }
    >
      <TransferAcceptInner />
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
  maxWidth: 480,
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
  marginTop: 20,
  padding: "12px 20px",
  borderRadius: 8,
  border: "none",
  background: "#34d399",
  color: "#0a0a0a",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtnStyle: CSSProperties = {
  marginTop: 10,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border, #27272a)",
  background: "transparent",
  color: "var(--fg, #fafafa)",
  fontSize: 13,
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  width: "100%",
  marginTop: 8,
  marginBottom: 8,
  padding: 16,
  borderRadius: 12,
  border: "1px solid var(--border, #27272a)",
  background: "var(--panel, #18181b)",
  boxSizing: "border-box",
};

const keyBoxStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: 10,
  borderRadius: 8,
  background: "#0a0a0a",
  border: "1px solid var(--border, #27272a)",
  fontSize: 12,
  wordBreak: "break-all",
  boxSizing: "border-box",
};
