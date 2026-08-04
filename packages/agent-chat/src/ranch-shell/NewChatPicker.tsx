"use client";

import { useState, type CSSProperties } from "react";
import type { AgentDirectoryItem } from "../types";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors, inputStyle } from "./styles";

type Props = {
  directoryAgents: AgentDirectoryItem[];
  allowGroupChat: boolean;
  busy: boolean;
  connectGuideUrl?: string;
  messages: RanchMessages;
  onClose: () => void;
  onOpenDirect: (agentId: string) => void;
  onCreateGroup: (title: string, agentIds: string[]) => void;
};

export function NewChatPicker({
  directoryAgents,
  allowGroupChat,
  busy,
  connectGuideUrl,
  messages: t,
  onClose,
  onOpenDirect,
  onCreateGroup,
}: Props) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState(t.defaultGroupTitle);
  const [manualId, setManualId] = useState("");

  const source: Record<
    "mine" | "recommended",
    { label: string; badge: string; border: string }
  > = {
    mine: { label: t.mineAgents, badge: colors.mine, border: "rgba(59,130,246,0.45)" },
    recommended: {
      label: t.recommended,
      badge: colors.recommended,
      border: "rgba(16,185,129,0.45)",
    },
  };

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : mode === "direct" ? [id] : [...prev, id],
    );
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={header}>
          <strong style={{ fontSize: 16 }}>{t.pickerTitle}</strong>
          <button type="button" onClick={onClose} style={btnGhost} aria-label={t.close}>
            ✕
          </button>
        </div>

        {allowGroupChat && (
          <div style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
            <button
              type="button"
              style={{ ...btnGhost, opacity: mode === "direct" ? 1 : 0.5 }}
              onClick={() => {
                setMode("direct");
                setSelected((s) => s.slice(0, 1));
              }}
            >
              1:1
            </button>
            <button
              type="button"
              style={{ ...btnGhost, opacity: mode === "group" ? 1 : 0.5 }}
              onClick={() => setMode("group")}
            >
              Group
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
          {(["mine", "recommended"] as const).map((group) => {
            const rows = directoryAgents.filter((a) => a.group === group);
            const cfg = source[group];
            return (
              <div key={group} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: cfg.badge,
                    marginBottom: 8,
                  }}
                >
                  {cfg.label}
                </div>
                {rows.length === 0 ? (
                  <div style={{ color: colors.muted, fontSize: 12 }}>
                    {group === "mine" ? (
                      <>
                        <p style={{ margin: "0 0 6px" }}>{t.noMineAgents}</p>
                        {connectGuideUrl ? (
                          <a
                            href={connectGuideUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: colors.mine }}
                          >
                            {t.copyPromptForAgent}
                          </a>
                        ) : null}
                      </>
                    ) : (
                      <p style={{ margin: 0 }}>{t.noRecommended}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {rows.map((a) => {
                      const on = selected.includes(a.agent_id);
                      return (
                        <button
                          key={a.agent_id}
                          type="button"
                          disabled={busy}
                          onClick={() => toggle(a.agent_id)}
                          style={{
                            ...rowBtn,
                            borderColor: on ? cfg.border : colors.border,
                            background: on ? colors.accentSoft : "transparent",
                          }}
                        >
                          <span
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: mode === "group" ? 8 : 999,
                              background: `linear-gradient(135deg, ${cfg.badge}, #0f766e)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                          >
                            {(a.name || a.agent_id).slice(0, 1).toUpperCase()}
                          </span>
                          <span style={{ textAlign: "left", minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>
                              {a.name?.trim() || a.agent_id}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: colors.muted,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {a.description?.trim() || a.agent_id}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>
              {t.orPasteAgentId}
            </div>
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder={t.agentIdPlaceholder}
              style={inputStyle}
            />
          </div>

          {mode === "group" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: colors.muted, marginBottom: 6 }}>{t.groupTitle}</div>
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        <div style={footer}>
          <button type="button" style={btnGhost} onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button
            type="button"
            style={btnPrimary}
            disabled={busy || (!selected.length && !manualId.trim())}
            onClick={() => {
              const ids = [
                ...selected,
                ...(manualId.trim() && !selected.includes(manualId.trim())
                  ? [manualId.trim()]
                  : []),
              ];
              if (!ids.length) return;
              if (mode === "direct") onOpenDirect(ids[0]);
              else onCreateGroup(groupTitle.trim() || t.defaultGroupTitle, ids);
            }}
          >
            {mode === "direct" ? t.startChatAction : t.createGroup}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 20,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: CSSProperties = {
  width: "min(440px, 100%)",
  maxHeight: "85%",
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 25px 50px rgba(0,0,0,0.45)",
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: `1px solid ${colors.border}`,
};

const footer: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: 12,
  borderTop: `1px solid ${colors.border}`,
};

const rowBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  cursor: "pointer",
  color: colors.text,
};
