import type { CSSProperties } from "react";

/** Ranch-like dark chrome tokens (self-contained, no Tailwind). */
export const colors = {
  bg: "#0f1419",
  panel: "#151b23",
  border: "rgba(255,255,255,0.06)",
  text: "#e8eef5",
  muted: "#94a3b8",
  hover: "rgba(255,255,255,0.05)",
  accent: "#3b82f6",
  accentSoft: "rgba(59,130,246,0.15)",
  mine: "#3b82f6",
  recommended: "#10b981",
  userBubble: "#1d4ed8",
  agentBubble: "#1e293b",
  danger: "#f87171",
};

export const shellRoot = (mode: "side" | "full"): CSSProperties =>
  mode === "full"
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        background: colors.bg,
        color: colors.text,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }
    : {
        position: "fixed",
        top: 0,
        right: 0,
        width: "min(420px, 100vw)",
        height: "100vh",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        background: colors.bg,
        color: colors.text,
        borderLeft: `1px solid ${colors.border}`,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      };

export const btnGhost: CSSProperties = {
  border: `1px solid ${colors.border}`,
  background: "transparent",
  color: colors.text,
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

/** Square icon control for shell header (fullscreen / collapse / close). */
export const btnIcon: CSSProperties = {
  ...btnGhost,
  width: 28,
  height: 28,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 0,
};

export const btnPrimary: CSSProperties = {
  ...btnGhost,
  background: colors.accent,
  border: `1px solid ${colors.accent}`,
  color: "#fff",
  fontWeight: 600,
};

/** Compact chip for group member targeting. */
export const memberChip: CSSProperties = {
  border: `1px solid ${colors.border}`,
  background: "transparent",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  cursor: "pointer",
  lineHeight: 1.2,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "#1e293b",
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  color: colors.text,
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
};
