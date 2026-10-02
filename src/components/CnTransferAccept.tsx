"use client";

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { getCnSessionToken, startWeChatLogin } from "@/lib/auth/cn";
import { getGatewayBaseUrl } from "@/lib/gateway";
import Loading from "@/components/Loading";

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
  const [keyCopied, setKeyCopied] = useState(false);

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

  if (!hydrated || loading) {
    return (
      <main style={pageStyle}>
        <Loading label="加载中…" style={{ color: "var(--muted)" }} />
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
        <p style={mutedStyle}>
          「{preview?.agent.name || "智能体"}」现在是你的了。
        </p>
        {apiKey ? (
          <div style={cardStyle}>
            <p style={{ ...mutedStyle, marginBottom: 8 }}>
              新 API Key（只显示这一次，旧 Key 已失效）：
            </p>
            <code style={keyBoxStyle}>{apiKey}</code>
            <button type="button" onClick={() => void copyKey()} style={secondaryBtnStyle}>
              {keyCopied ? "已复制" : "复制 Key"}
            </button>
          </div>
        ) : null}
        <a href="/" style={ctaLinkStyle}>
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
          {preview?.from_nickname || "好友"} 赠送了「{preview?.agent.name || "智能体"}」
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
        {preview?.from_nickname || "好友"} 赠送了「{preview?.agent.name || "智能体"}」
      </p>
      <p style={{ color: "#d97706", fontSize: 13, lineHeight: 1.45, margin: 0 }}>
        领取后所有权转到你的账号，原主人将失去控制；自主运行的智能体会换发新 API Key。
      </p>
      {error ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p> : null}
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
          <Loading label="加载中…" style={{ color: "var(--muted)" }} />
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
  padding: "48px 24px",
  paddingInline: "max(24px, calc((100vw - 480px) / 2))",
  gap: 12,
  boxSizing: "border-box",
  background:
    "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(34,211,238,0.12), transparent 55%), var(--bg)",
};
const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.02em",
};
const mutedStyle: CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: 1.5, margin: 0 };
const linkStyle: CSSProperties = { color: "var(--accent)", textDecoration: "none", fontSize: 13 };
const cardStyle: CSSProperties = {
  width: "100%",
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
const ctaLinkStyle: CSSProperties = {
  marginTop: 8,
  display: "inline-block",
  border: "none",
  borderRadius: 999,
  background: "var(--accent)",
  color: "#052e16",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 22px",
  textDecoration: "none",
};
const btnStyle: CSSProperties = {
  marginTop: 8,
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#052e16",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 22px",
  cursor: "pointer",
};
