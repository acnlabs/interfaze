"use client";

import type { CSSProperties } from "react";
import { getAgentPlanetBaseUrl } from "@/lib/region";

export type AgentGiftPreview = {
  agent: { name: string; description: string | null; status: string };
  agent_id: string;
  from_nickname: string;
  expires_at: string;
};

type Labels = {
  agent: string;
  online: string;
  offline: string;
  id: string;
  from: string;
  expires: (when: string) => string;
  viewProfile: string;
};

const EN: Labels = {
  agent: "Agent",
  online: "Online",
  offline: "Offline",
  id: "ID",
  from: "From",
  expires: (when) => `expires ${when}`,
  viewProfile: "View profile on AgentPlanet →",
};

const ZH: Labels = {
  agent: "智能体",
  online: "在线",
  offline: "离线",
  id: "ID",
  from: "来自",
  expires: (when) => `${when} 前有效`,
  viewProfile: "在 AgentPlanet 查看主页 →",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const one = parts[0] || "?";
  return one.slice(0, 2).toUpperCase();
}

// Styles above the component so Fast Refresh never hits a TDZ on const bindings.
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

const eyebrowStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--muted, #a1a1aa)",
};

const headerLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  textDecoration: "none",
  color: "inherit",
  borderRadius: 8,
};

const profileLinkStyle: CSSProperties = {
  display: "inline-block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--accent, #34d399)",
  textDecoration: "none",
};

const avatarStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#f8fafc",
  background: "linear-gradient(135deg, #334155, #1e293b)",
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const agentTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  color: "var(--fg, #fafafa)",
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  lineHeight: 1.4,
};

const idLineStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "var(--muted, #a1a1aa)",
  lineHeight: 1.4,
};

const idCodeStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
  color: "var(--fg, #e4e4e7)",
  wordBreak: "break-all",
};

const mutedStyle: CSSProperties = {
  color: "var(--muted, #a1a1aa)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
};

export function AgentGiftPreviewCard({
  preview,
  locale = "en",
  style,
}: {
  preview: AgentGiftPreview;
  locale?: "en" | "zh";
  style?: CSSProperties;
}) {
  const t = locale === "zh" ? ZH : EN;
  const name = preview.agent.name?.trim() || preview.agent_id;
  const online = preview.agent.status === "online";
  const when = new Date(preview.expires_at).toLocaleString();
  const from = preview.from_nickname?.trim() || (locale === "zh" ? "某人" : "Someone");
  const profileUrl = `${getAgentPlanetBaseUrl()}/agents/${encodeURIComponent(preview.agent_id)}`;

  return (
    <div style={{ ...cardStyle, ...style }}>
      <p style={eyebrowStyle}>{t.agent}</p>
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={headerLinkStyle}
        aria-label={t.viewProfile}
      >
        <div style={avatarStyle} aria-hidden>
          {initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleRowStyle}>
            <h2 style={agentTitleStyle}>{name}</h2>
            <span
              style={{
                ...statusPillStyle,
                color: online ? "#86efac" : "var(--muted, #a1a1aa)",
                background: online ? "rgba(34,197,94,0.15)" : "rgba(161,161,170,0.12)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: online ? "#22c55e" : "var(--muted, #a1a1aa)",
                }}
              />
              {online ? t.online : t.offline}
            </span>
          </div>
          <p style={idLineStyle}>
            <span style={{ opacity: 0.75 }}>{t.id}</span>{" "}
            <code style={idCodeStyle} title={preview.agent_id}>
              {preview.agent_id}
            </code>
          </p>
        </div>
      </a>
      {preview.agent.description ? (
        <p style={{ ...mutedStyle, marginTop: 12 }}>{preview.agent.description}</p>
      ) : null}
      <p style={{ ...mutedStyle, fontSize: 12, marginTop: 12, marginBottom: 8 }}>
        {t.from} {from} · {t.expires(when)}
      </p>
      <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={profileLinkStyle}>
        {t.viewProfile}
      </a>
    </div>
  );
}
