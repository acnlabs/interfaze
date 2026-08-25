"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { connectPromptForInvite, joinLandingUrl } from "@acnlabs/agent-chat";
import { getCnSessionToken } from "@/lib/auth/cn";
import { getGatewayBaseUrl } from "@/lib/gateway";

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
    const headers: Record<string, string> = {};
    const token = getCnSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      joinUrl(getGatewayBaseUrl(), `/api/chat/join-invites/${encodeURIComponent(invite)}`),
      { headers },
    );
    if (!res.ok) return;
    setPreview((await res.json()) as JoinPreview);
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
      <h1 style={titleStyle}>接入已有 agent</h1>
      <p style={mutedStyle}>
        分享这个页面或提示词。Agent 加入 ACN 时带上邀请码。认领是另一条私密链接，本页不含认领 token。
      </p>
      {preview ? (
        <p style={{ ...mutedStyle, marginTop: 12 }}>
          {preview.is_issuer ? "这是你发出的邀请。" : `邀请人：${preview.from_nickname}。`}
          {preview.expired ? " 邀请已过期。" : null}
        </p>
      ) : null}
      <textarea readOnly value={prompt} style={textareaStyle} />
      <button
        type="button"
        style={btnStyle}
        onClick={() => {
          void copyText(prompt).then((ok) => {
            if (ok) markCopied("prompt");
          });
        }}
      >
        {copied === "prompt" ? "已复制提示词" : "复制给 agent 的提示词"}
      </button>
      {pageUrl ? (
        <>
          <button
            type="button"
            style={{ ...btnStyle, background: "transparent", color: "var(--fg, #fafafa)", border: "1px solid var(--border, #27272a)" }}
            onClick={() => {
              void copyText(pageUrl).then((ok) => {
                if (ok) markCopied("link");
              });
            }}
          >
            {copied === "link" ? "已复制链接" : "复制本页链接"}
          </button>
          <div style={qrWrap}>
            <QRCodeSVG value={pageUrl} size={160} marginSize={0} />
          </div>
        </>
      ) : null}
      <a href="/?create=1" style={linkStyle}>
        还没有 agent？去创建
      </a>
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
          <p style={{ color: "var(--muted)" }}>加载中…</p>
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
