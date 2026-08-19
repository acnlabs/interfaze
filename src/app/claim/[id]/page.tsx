"use client";

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  isAuth0Configured,
} from "@/lib/auth0";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { isCnRegion } from "@/lib/region";
import CnClaim from "@/components/CnClaim";

type ClaimPreview = {
  agent_id: string;
  name: string;
  description: string | null;
  claim_status: string;
  is_owner: boolean;
  token_present: boolean;
};

type ClaimResult = {
  success: boolean;
  agent_id: string;
  already_owned?: boolean;
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

function ClaimInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = String(params.id ?? "").trim();
  const claimToken = searchParams.get("token") ?? "";
  const {
    isAuthenticated,
    isLoading: authLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();

  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const loadPreview = useCallback(
    async (bearer?: string | null) => {
      if (!agentId) return;
      const headers: Record<string, string> = {};
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      const qs = claimToken
        ? `?token=${encodeURIComponent(claimToken)}`
        : "";
      const res = await fetch(
        joinUrl(getGatewayBaseUrl(), `/api/chat/claim/${encodeURIComponent(agentId)}${qs}`),
        { headers },
      );
      if (!res.ok) throw new Error(await parseError(res));
      return (await res.json()) as ClaimPreview;
    },
    [agentId, claimToken],
  );

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        let bearer: string | null = null;
        if (isAuthenticated && isAuth0Configured()) {
          try {
            bearer = await getAccessTokenSilently({
              authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
            });
          } catch {
            bearer = null;
          }
        }
        const data = await loadPreview(bearer);
        if (!cancelled && data) {
          setPreview(data);
          if (data.is_owner) setDone(true);
        }
      } catch {
        if (!cancelled) setError("This agent could not be found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (!authLoading) void run();
    return () => {
      cancelled = true;
    };
  }, [agentId, authLoading, getAccessTokenSilently, isAuthenticated, loadPreview]);

  const handleLogin = () => {
    if (!isAuth0Configured()) return;
    const returnTo =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : `/claim/${agentId}`;
    void loginWithRedirect({
      appState: { returnTo },
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPE,
      },
    });
  };

  const openChat = () => {
    const id = preview?.agent_id || agentId;
    router.replace(`/?agent=${encodeURIComponent(id)}`);
  };

  const handleClaim = useCallback(async () => {
    if (!claimToken || !agentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
      });
      const res = await fetch(
        joinUrl(getGatewayBaseUrl(), `/api/chat/claim/${encodeURIComponent(agentId)}`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ verification_code: claimToken }),
        },
      );
      if (!res.ok) {
        try {
          const fresh = await loadPreview(token);
          if (fresh?.is_owner) {
            setPreview(fresh);
            setDone(true);
            return;
          }
        } catch {
          /* keep POST error */
        }
        throw new Error(await parseError(res));
      }
      const data = (await res.json()) as ClaimResult;
      setDone(true);
      if (data.agent_id) {
        setPreview((cur) =>
          cur
            ? { ...cur, agent_id: data.agent_id, is_owner: true, claim_status: "claimed" }
            : cur,
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not claim this agent.");
    } finally {
      setSubmitting(false);
    }
  }, [agentId, claimToken, getAccessTokenSilently, loadPreview]);

  if (loading || authLoading) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  if (!agentId) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Invalid link</h1>
        <p style={mutedStyle}>This claim link is missing an agent id.</p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  if (!claimToken && !preview?.is_owner && !done) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Invalid link</h1>
        <p style={mutedStyle}>This claim link is missing a token. Ask your agent for a new one, or connect it from Interfaze.</p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  if (error && !preview) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Agent unavailable</h1>
        <p style={mutedStyle}>{error}</p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  const taken =
    preview &&
    preview.claim_status === "claimed" &&
    !preview.is_owner &&
    !done;

  if (taken) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Already claimed</h1>
        <p style={mutedStyle}>Someone else already owns this agent.</p>
        <a href="/" style={linkStyle}>
          Back to Interfaze
        </a>
      </main>
    );
  }

  if (done || preview?.is_owner) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>You’re the owner</h1>
        <p style={mutedStyle}>
          <strong style={{ color: "var(--fg, #fafafa)" }}>{preview?.name ?? "This agent"}</strong>{" "}
          is yours on Interfaze.
        </p>
        <button type="button" style={ctaStyle} onClick={openChat}>
          Open chat
        </button>
        <a href="/?account=manage" style={linkStyle}>
          Manage this agent
        </a>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Claim your agent</h1>
        <p style={mutedStyle}>
          Sign in to claim{" "}
          <strong style={{ color: "var(--fg, #fafafa)" }}>
            {preview?.name ?? "this agent"}
          </strong>{" "}
          and start chatting.
        </p>
        {preview?.description ? (
          <p style={{ ...mutedStyle, marginTop: 8 }}>{preview.description}</p>
        ) : null}
        <button type="button" onClick={handleLogin} style={ctaStyle}>
          Log in to claim
        </button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>Claim and chat</h1>
      {preview ? (
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{preview.name}</h2>
          {preview.description ? (
            <p style={{ ...mutedStyle, marginBottom: 0 }}>{preview.description}</p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleClaim()}
        disabled={submitting}
        style={{ ...ctaStyle, opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? "Claiming…" : "Claim and open chat"}
      </button>
    </main>
  );
}

export default function ClaimPage() {
  if (isCnRegion()) return <CnClaim />;
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </main>
      }
    >
      <ClaimInner />
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
