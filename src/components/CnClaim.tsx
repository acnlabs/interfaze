"use client";

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getCnSessionToken, startWeChatLogin } from "@/lib/auth/cn";
import { getGatewayBaseUrl } from "@/lib/gateway";

type ClaimPreview = {
  agent_id: string;
  name: string;
  description: string | null;
  claim_status: string;
  is_owner: boolean;
  token_present: boolean;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: { message?: string } | string;
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
  return `请求失败（${res.status}）`;
}

function CnClaimInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = String(params.id ?? "").trim();
  const claimToken = searchParams.get("token") ?? "";

  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getCnSessionToken()));
    setHydrated(true);
  }, []);

  const loadPreview = useCallback(
    async (bearer?: string | null) => {
      if (!agentId) return;
      const headers: Record<string, string> = {};
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      const qs = claimToken ? `?token=${encodeURIComponent(claimToken)}` : "";
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
    if (!hydrated || !agentId) {
      if (hydrated) setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadPreview(getCnSessionToken());
        if (!cancelled && data) {
          setPreview(data);
          if (data.is_owner) setDone(true);
        }
      } catch {
        if (!cancelled) setError("找不到这只 agent");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, hydrated, loadPreview]);

  const openChat = () => {
    const id = preview?.agent_id || agentId;
    router.replace(`/?agent=${encodeURIComponent(id)}`);
  };

  const handleClaim = useCallback(async () => {
    if (!claimToken || !agentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = getCnSessionToken();
      if (!token) throw new Error("未登录");
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
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "认领失败");
    } finally {
      setSubmitting(false);
    }
  }, [agentId, claimToken, loadPreview]);

  if (!hydrated || loading) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "var(--muted)" }}>加载中…</p>
      </main>
    );
  }

  if (!claimToken && !preview?.is_owner && !done) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>链接无效</h1>
        <p style={mutedStyle}>缺少认领凭证。请让你的 agent 再发一次，或回界面接入。</p>
        <a href="/" style={linkStyle}>
          返回界面
        </a>
      </main>
    );
  }

  if (error && !preview) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>无法认领</h1>
        <p style={mutedStyle}>{error}</p>
        <a href="/" style={linkStyle}>
          返回界面
        </a>
      </main>
    );
  }

  if (preview?.claim_status === "claimed" && !preview.is_owner && !done) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>已被认领</h1>
        <p style={mutedStyle}>这只 agent 已经有主人了。</p>
        <a href="/" style={linkStyle}>
          返回界面
        </a>
      </main>
    );
  }

  if (done || preview?.is_owner) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>认领成功</h1>
        <p style={mutedStyle}>「{preview?.name || "Agent"}」已经是你的了。</p>
        <button type="button" style={btnStyle} onClick={openChat}>
          开聊
        </button>
        <a href="/?account=manage" style={linkStyle}>
          管理这只 agent
        </a>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>认领你的 agent</h1>
        <p style={mutedStyle}>登录后认领「{preview?.name || "这只 agent"}」并开始对话。</p>
        <button
          type="button"
          style={btnStyle}
          onClick={() =>
            startWeChatLogin(
              typeof window !== "undefined"
                ? window.location.pathname + window.location.search
                : `/claim/${agentId}`,
            )
          }
        >
          微信登录后认领
        </button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>认领并开聊</h1>
      {preview?.description ? <p style={mutedStyle}>{preview.description}</p> : null}
      {error ? (
        <p style={{ color: "#f87171", fontSize: 13, margin: "12px 0" }}>{error}</p>
      ) : null}
      <button
        type="button"
        style={{ ...btnStyle, opacity: submitting ? 0.6 : 1 }}
        disabled={submitting}
        onClick={() => void handleClaim()}
      >
        {submitting ? "认领中…" : "认领并开聊"}
      </button>
    </main>
  );
}

export default function CnClaim() {
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <p style={{ color: "var(--muted)" }}>加载中…</p>
        </main>
      }
    >
      <CnClaimInner />
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

const btnStyle: CSSProperties = {
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
