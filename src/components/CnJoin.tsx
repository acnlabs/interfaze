"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { connectPromptForInvite, joinLandingUrl } from "@acnlabs/agent-chat";
import { getCnSessionToken } from "@/lib/auth/cn";
import { getGatewayBaseUrl } from "@/lib/gateway";
import Loading from "@/components/Loading";

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

function CnJoinInner() {
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") || "").trim();
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [copied, setCopied] = useState<"prompt" | "link" | null>(null);
  const [pageUrl, setPageUrl] = useState("");

  const prompt = useMemo(
    () =>
      connectPromptForInvite(
        "zh",
        invite || undefined,
        typeof window !== "undefined" ? window.location.origin : "https://interfaze.acnlabs.cn",
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
    const token = getCnSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
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
  }, [invite]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const markCopied = (kind: "prompt" | "link") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>接入已有智能体</h1>
      <p style={mutedStyle}>
        分享这个页面或提示词，让你的智能体凭邀请码加入。所有权始终在你手里——本页不含任何所有权凭证。
      </p>
      {previewError ? (
        <p style={{ ...mutedStyle, marginTop: 12, color: "#f87171" }}>
          邀请预览加载失败。{" "}
          <button
            type="button"
            onClick={() => void loadPreview()}
            style={{ ...btnStyle, background: "transparent", color: "var(--fg, #fafafa)", border: "1px solid var(--border, #27272a)", padding: "4px 12px", fontSize: 12, marginLeft: 4 }}
          >
            重试
          </button>
        </p>
      ) : null}
      {preview ? (
        <p style={{ ...mutedStyle, marginTop: 12 }}>
          {preview.is_issuer ? "这是你发出的邀请。" : `邀请人：${preview.from_nickname}。`}
          {preview.expired ? " 邀请已过期。" : null}
        </p>
      ) : null}
      <textarea readOnly value={prompt} style={textareaStyle} />
      <button
        type="button"
        style={{
          ...btnStyle,
          ...(preview?.expired ? { opacity: 0.5, cursor: "not-allowed" } : null),
        }}
        disabled={preview?.expired}
        onClick={() => {
          void copyText(prompt).then((ok) => {
            if (ok) markCopied("prompt");
          });
        }}
      >
        {copied === "prompt" ? "已复制提示词" : "复制给智能体的提示词"}
      </button>
      {pageUrl ? (
        <>
          <button
            type="button"
            style={{
              ...btnStyle,
              background: "transparent",
              color: "var(--fg, #fafafa)",
              border: "1px solid var(--border, #27272a)",
              ...(preview?.expired ? { opacity: 0.5, cursor: "not-allowed" } : null),
            }}
            disabled={preview?.expired}
            onClick={() => {
              void copyText(pageUrl).then((ok) => {
                if (ok) markCopied("link");
              });
            }}
          >
            {copied === "link" ? "已复制链接" : "复制本页链接"}
          </button>
          <div style={qrWrap}>
            <QRCodeSVG value={pageUrl} size={160} marginSize={2} />
          </div>
        </>
      ) : null}
      <a href="/" style={linkStyle}>
        返回界面
      </a>
    </main>
  );
}

export default function CnJoin() {
  return (
    <Suspense
      fallback={
        <main style={pageStyle}>
          <Loading label="加载中…" style={{ color: "var(--muted)" }} />
        </main>
      }
    >
      <CnJoinInner />
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

const btnStyle: CSSProperties = {
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
