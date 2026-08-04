"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { AgentDirectoryItem } from "../types";
import { CONNECT_PROMPTS, copyText } from "./connectPrompt";
import type { RanchLocale, RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors, inputStyle } from "./styles";

type Props = {
  directoryAgents: AgentDirectoryItem[];
  allowGroupChat: boolean;
  busy: boolean;
  connectGuideUrl?: string;
  locale: RanchLocale;
  messages: RanchMessages;
  /** Optional D9 discover search (public / invited agents). */
  onSearchDiscover?: (q: string) => Promise<AgentDirectoryItem[]>;
  onClose: () => void;
  onOpenDirect: (agentId: string) => void;
  onCreateGroup: (title: string, agentIds: string[]) => void;
};

export function NewChatPicker({
  directoryAgents,
  allowGroupChat,
  busy,
  connectGuideUrl,
  locale,
  messages: t,
  onSearchDiscover,
  onClose,
  onOpenDirect,
  onCreateGroup,
}: Props) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState(t.defaultGroupTitle);
  const [manualId, setManualId] = useState("");
  const [showPasteId, setShowPasteId] = useState(false);
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverRows, setDiscoverRows] = useState<AgentDirectoryItem[]>(() =>
    directoryAgents.filter((a) => a.group === "recommended"),
  );
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!onSearchDiscover) {
      setDiscoverRows(directoryAgents.filter((a) => a.group === "recommended"));
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setDiscoverLoading(true);
      void onSearchDiscover(discoverQ)
        .then((rows) => {
          if (!cancelled) setDiscoverRows(rows);
        })
        .catch(() => {
          if (!cancelled) setDiscoverRows([]);
        })
        .finally(() => {
          if (!cancelled) setDiscoverLoading(false);
        });
    }, discoverQ ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [discoverQ, onSearchDiscover, directoryAgents]);

  const mineRows = directoryAgents.filter((a) => a.group === "mine");
  const pickedIds = [
    ...selected,
    ...(manualId.trim() && !selected.includes(manualId.trim()) ? [manualId.trim()] : []),
  ];
  const canStartDirect = pickedIds.length > 0;
  const canCreateGroup = pickedIds.length >= 2;

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : mode === "direct" ? [id] : [...prev, id],
    );
  };

  const renderAgentButton = (a: AgentDirectoryItem, accent: string, border: string) => {
    const on = selected.includes(a.agent_id);
    return (
      <button
        key={a.agent_id}
        type="button"
        disabled={busy}
        onClick={() => toggle(a.agent_id)}
        style={{
          ...rowBtn,
          borderColor: on ? border : colors.border,
          background: on ? colors.accentSoft : "transparent",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: mode === "group" ? 8 : 999,
            background: `linear-gradient(135deg, ${accent}, #0f766e)`,
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
              {t.groupMode}
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: colors.mine,
                marginBottom: 8,
              }}
            >
              {t.mineAgents}
            </div>
            {mineRows.length === 0 ? (
              <div style={{ color: colors.muted, fontSize: 12 }}>
                <p style={{ margin: "0 0 8px" }}>{t.noMineAgents}</p>
                <button
                  type="button"
                  style={{ ...btnPrimary, fontSize: 12, padding: "6px 10px" }}
                  onClick={() => {
                    void copyText(CONNECT_PROMPTS[locale]).then((ok) => {
                      if (!ok) return;
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                >
                  {copied ? t.promptCopied : t.copyPromptForAgent}
                </button>
                {connectGuideUrl ? (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={connectGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: colors.mine, fontSize: 12 }}
                    >
                      {t.viewConnectGuide}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {mineRows.map((a) =>
                  renderAgentButton(a, colors.mine, "rgba(59,130,246,0.45)"),
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: colors.recommended,
                marginBottom: 8,
              }}
            >
              {t.recommended}
            </div>
            {onSearchDiscover ? (
              <input
                value={discoverQ}
                onChange={(e) => setDiscoverQ(e.target.value)}
                placeholder={t.searchAgents}
                style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}
              />
            ) : null}
            {discoverLoading ? (
              <p style={{ color: colors.muted, fontSize: 12, margin: 0 }}>{t.loading}</p>
            ) : discoverRows.length === 0 ? (
              <p style={{ color: colors.muted, fontSize: 12, margin: 0 }}>{t.noRecommended}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {discoverRows.map((a) =>
                  renderAgentButton(a, colors.recommended, "rgba(16,185,129,0.45)"),
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowPasteId((v) => !v)}
              style={{
                ...btnGhost,
                fontSize: 11,
                padding: "4px 8px",
                color: colors.muted,
              }}
            >
              {showPasteId ? `▾ ${t.pasteAgentIdAdvanced}` : `▸ ${t.pasteAgentIdAdvanced}`}
            </button>
            {showPasteId ? (
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder={t.agentIdPlaceholder}
                style={{ ...inputStyle, marginTop: 8 }}
              />
            ) : null}
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {mode === "group" && pickedIds.length > 0 && !canCreateGroup ? (
              <span style={{ fontSize: 11, color: colors.muted }}>{t.minTwoAgents}</span>
            ) : null}
            <button
              type="button"
              style={btnPrimary}
              disabled={busy || (mode === "direct" ? !canStartDirect : !canCreateGroup)}
              onClick={() => {
                if (mode === "direct") {
                  if (!canStartDirect) return;
                  onOpenDirect(pickedIds[0]);
                  return;
                }
                if (!canCreateGroup) return;
                onCreateGroup(groupTitle.trim() || t.defaultGroupTitle, pickedIds);
              }}
            >
              {mode === "direct" ? t.startChatAction : t.createGroup}
            </button>
          </div>
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
