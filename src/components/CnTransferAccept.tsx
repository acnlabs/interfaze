"use client";

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { getCnSessionToken, startWeChatLogin } from "@/lib/auth/cn";
import { getGatewayBaseUrl } from "@/lib/gateway";

type InvitePreview = {
  agent: { name: string; description: string | null; status: string };
  from_nickname: string;
  expires_at: string;
  expired: boolean;
  consumed: boolean;
  agent_id: string;
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

function CnTransferInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(Boolean(getCnSessionToken()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!inviteToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          joinUrl(
            getGatewayBaseUrl(),
            `/api/chat/transfer-invites/${encodeURIComponent(inviteToken)}`,
          ),
        );
        if (!res.ok) throw new Error(await parseError(res));
        const data = (await res.json()) as InvitePreview;
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError("邀请链接无效或已过期");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const handleAccept = useCallback(async () => {
    if (!inviteToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = getCnSessionToken();
      if (!token) throw new Error("未登录");
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
      const data = (await res.json()) as { api_key?: string | null };
      setAccepted(true);
      if (typeof data.api_key === "string" && data.api_key.trim()) {
        setApiKey(data.api_key);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "领取失败");
    } finally {
      setSubmitting(false);
    }
  }, [inviteToken]);

  if (!hydrated || loading) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "var(--muted)" }}>加载中…</p>
      </main>
    );
  }

  if (!inviteToken) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>无效邀请</h1>
        <a href="/" style={linkStyle}>
          返回界面
        </a>
      </main>
    );
  }

  if (error && !preview) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>邀请不可用</h1>
        <p style={mutedStyle}>{error}</p>
        <a href="/" style={linkStyle}>
          返回界面
        </a>
      </main>
    );
  }

  if (preview?.consumed || preview?.expired) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>{preview.consumed ? "已被领取" : "邀请已过期"}</h1>
        <a href="/" style={linkStyle}>
          返回界面
        </a>
      </main>
    );
  }

  if (accepted) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>领取成功</h1>
        {apiKey ? (
          <p style={mutedStyle}>
            API Key：<code>{apiKey}</code>
          </p>
        ) : null}
        <a href="/" style={linkStyle}>
          打开界面
        </a>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>领取赠送</h1>
        <p style={mutedStyle}>
          {preview?.from_nickname || "好友"} 赠送了「{preview?.agent.name || "Agent"}」
        </p>
        <button
          type="button"
          style={btnStyle}
          onClick={() =>
            startWeChatLogin(
              typeof window !== "undefined"
                ? window.location.pathname + window.location.search
                : "/transfer/accept",
            )
          }
        >
          微信登录后领取
        </button>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>领取赠送</h1>
      <p style={mutedStyle}>
        {preview?.from_nickname || "好友"} 赠送了「{preview?.agent.name || "Agent"}」
      </p>
      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
      <button type="button" style={btnStyle} disabled={submitting} onClick={() => void handleAccept()}>
        {submitting ? "领取中…" : "确认领取"}
      </button>
    </main>
  );
}

export default function CnTransferAccept() {
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <p style={{ color: "var(--muted)" }}>加载中…</p>
        </main>
      }
    >
      <CnTransferInner />
    </Suspense>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "48px 32px",
  gap: 12,
  background:
    "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(34,211,238,0.12), transparent 55%), var(--bg)",
};
const titleStyle: CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0 };
const mutedStyle: CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: 1.5, margin: 0 };
const linkStyle: CSSProperties = { color: "var(--accent)", textDecoration: "none", fontSize: 13 };
const btnStyle: CSSProperties = {
  marginTop: 8,
  border: "none",
  borderRadius: 999,
  background: "var(--accent)",
  color: "#052e1f",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 22px",
  cursor: "pointer",
};
