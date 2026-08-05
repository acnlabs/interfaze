"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { GatewayClient, MyAgentSummary } from "../gateway";
import { CONNECT_PROMPTS, copyText } from "./connectPrompt";
import type { RanchLocale, RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

type Props = {
  client: GatewayClient;
  connectGuideUrl?: string;
  /** AgentPlanet origin for gift deep-link. Default https://agentplanet.org */
  agentPlanetBaseUrl?: string;
  locale: RanchLocale;
  messages: RanchMessages;
  busy?: boolean;
  onClose: () => void;
  onOpenChat: (agentId: string) => void;
};

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function deliveryLabel(delivery: string | null | undefined, t: RanchMessages): string {
  if (delivery === "direct") return t.myAgentsDeliveryDirect;
  if (delivery === "relay") return t.myAgentsDeliveryRelay;
  if (delivery === "none") return t.myAgentsDeliveryNone;
  return t.unknown;
}

function boolLabel(v: boolean | null | undefined, t: RanchMessages): string {
  if (v === true) return t.yes;
  if (v === false) return t.no;
  return t.unknown;
}

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
  fontSize: 13,
  borderBottom: `1px solid ${colors.border}`,
};

function DetailRows({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} style={rowStyle}>
          <span style={{ color: colors.muted, flexShrink: 0 }}>{r.label}</span>
          <span
            style={{
              textAlign: "right",
              wordBreak: "break-all",
              color: colors.text,
            }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MyAgentsPanel({
  client,
  connectGuideUrl,
  agentPlanetBaseUrl = "https://agentplanet.org",
  locale,
  messages: t,
  busy,
  onClose,
  onOpenChat,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<MyAgentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyAgentSummary | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void client
      .listMyAgents(50)
      .then((rows) => {
        if (!cancelled) setAgents(rows);
      })
      .catch(() => {
        if (!cancelled) setError(t.myAgentsLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, t.myAgentsLoadFailed]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setNewApiKey(null);
      setConfirmRotate(false);
      setRotateError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void client
      .getMyAgent(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch(() => {
        if (cancelled) return;
        // Never fall back to list cache — avoids showing Connect/Access after 403.
        setDetail(null);
        setDetailError(t.myAgentsLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, client, t.myAgentsLoadFailed]);

  const copyPrompt = () => {
    void copyText(CONNECT_PROMPTS[locale]).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const giftUrl = detail
    ? `${agentPlanetBaseUrl.replace(/\/+$/, "")}/agents/${encodeURIComponent(detail.agent_id)}`
    : null;

  const runRotate = () => {
    if (!detail) return;
    setRotating(true);
    setRotateError(null);
    void client
      .rotateMyAgentKey(detail.agent_id)
      .then((res) => {
        setConfirmRotate(false);
        setNewApiKey(res.api_key);
        setKeyCopied(false);
      })
      .catch(() => {
        setRotateError(t.myAgentsRotateFailed);
        setConfirmRotate(false);
      })
      .finally(() => setRotating(false));
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          style={btnGhost}
          onClick={() => {
            if (selectedId) {
              setSelectedId(null);
              return;
            }
            onClose();
          }}
          aria-label={selectedId ? t.myAgentsBack : t.close}
        >
          ←
        </button>
        <strong style={{ fontSize: 14, flex: 1 }}>
          {selectedId ? detail?.name || shortId(selectedId) : t.myAgentsTitle}
        </strong>
        <span style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: selectedId ? 16 : 0 }}>
        {selectedId ? (
          detailLoading && !detail ? (
            <p style={{ color: colors.muted, fontSize: 13, padding: 16 }}>{t.loading}</p>
          ) : detail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section>
                <h3 style={sectionTitle}>{t.myAgentsSectionIdentity}</h3>
                <DetailRows
                  rows={[
                    { label: t.statusLabel, value: detail.status === "online" ? t.online : t.offline },
                    { label: t.myAgentsShortId, value: detail.agent_id },
                    {
                      label: "Claim",
                      value: detail.claim_status || t.unknown,
                    },
                    ...(detail.last_heartbeat
                      ? [{ label: t.myAgentsLastHeartbeat, value: detail.last_heartbeat }]
                      : []),
                    ...(detail.description
                      ? [{ label: "Desc", value: detail.description }]
                      : []),
                    ...(detail.tags && detail.tags.length > 0
                      ? [{ label: "Tags", value: detail.tags.join(", ") }]
                      : []),
                  ]}
                />
              </section>
              <section>
                <h3 style={sectionTitle}>{t.myAgentsSectionConnect}</h3>
                <DetailRows
                  rows={[
                    {
                      label: t.myAgentsDelivery,
                      value: deliveryLabel(detail.delivery, t),
                    },
                    {
                      label: t.myAgentsEndpoint,
                      value: detail.endpoint_masked || "—",
                    },
                    {
                      label: t.myAgentsInbound,
                      value: boolLabel(detail.inbound_reachable, t),
                    },
                  ]}
                />
                {detail.status !== "online" ? (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
                    {t.myAgentsOfflineHint}
                  </p>
                ) : null}
                {connectGuideUrl ? (
                  <a
                    href={connectGuideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 12,
                      color: colors.muted,
                    }}
                  >
                    {t.viewConnectGuide}
                  </a>
                ) : null}
              </section>
              <section>
                <h3 style={sectionTitle}>{t.myAgentsSectionAccess}</h3>
                <DetailRows
                  rows={[
                    {
                      label: t.myAgentsPolicy,
                      value: detail.policy_mode || t.unknown,
                    },
                    {
                      label: t.myAgentsChatOpen,
                      value: boolLabel(detail.chat_open, t),
                    },
                  ]}
                />
                {rotateError ? (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: colors.danger }}>
                    {rotateError}
                  </p>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...btnGhost,
                      width: "100%",
                      borderColor: "rgba(248,113,113,0.45)",
                      color: colors.danger,
                    }}
                    disabled={busy || rotating}
                    onClick={() => {
                      setRotateError(null);
                      setConfirmRotate(true);
                    }}
                  >
                    {t.myAgentsRotateKey}
                  </button>
                  {giftUrl ? (
                    <a
                      href={giftUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...btnGhost,
                        display: "block",
                        width: "100%",
                        textAlign: "center",
                        textDecoration: "none",
                        boxSizing: "border-box",
                      }}
                    >
                      {t.myAgentsGift}
                      <span style={{ color: colors.muted, marginLeft: 6, fontSize: 11 }}>
                        ({t.myAgentsGiftExternal})
                      </span>
                    </a>
                  ) : null}
                </div>
              </section>
              <button
                type="button"
                style={{ ...btnPrimary, width: "100%" }}
                disabled={busy}
                onClick={() => onOpenChat(detail.agent_id)}
              >
                {t.myAgentsOpenChat}
              </button>
            </div>
          ) : (
            <p style={{ color: colors.danger, fontSize: 13 }}>
              {detailError || t.myAgentsLoadFailed}
            </p>
          )
        ) : loading ? (
          <p style={{ color: colors.muted, fontSize: 13, padding: 16 }}>{t.loading}</p>
        ) : error ? (
          <p style={{ color: colors.danger, fontSize: 13, padding: 16 }}>{error}</p>
        ) : agents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 20px", color: colors.muted }}>
            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: colors.text }}>
              {t.myAgentsEmptyTitle}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 12, lineHeight: 1.55 }}>{t.myAgentsEmptyBody}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              <button type="button" style={btnPrimary} onClick={copyPrompt}>
                {copied ? t.promptCopied : t.copyPromptForAgent}
              </button>
              {connectGuideUrl ? (
                <a
                  href={connectGuideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: colors.muted, fontSize: 12 }}
                >
                  {t.viewConnectGuide}
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {agents.map((a) => {
              const online = a.status === "online";
              return (
                <li key={a.agent_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.agent_id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: `1px solid ${colors.border}`,
                      background: "transparent",
                      color: colors.text,
                      padding: "12px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      aria-hidden
                      title={online ? t.online : t.offline}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: online ? "#22c55e" : colors.muted,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.name || shortId(a.agent_id)}
                      </span>
                      <span style={{ fontSize: 11, color: colors.muted }}>
                        {deliveryLabel(a.delivery, t)} · {shortId(a.agent_id)}
                      </span>
                    </span>
                    <span style={{ color: colors.muted, fontSize: 14 }}>›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmRotate ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => {
            if (!rotating) setConfirmRotate(false);
          }}
        >
          <div
            style={{
              width: "min(340px, 100%)",
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.5 }}>
              {t.myAgentsRotateConfirm}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={btnGhost}
                disabled={rotating}
                onClick={() => setConfirmRotate(false)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                style={{
                  ...btnGhost,
                  background: "rgba(248,113,113,0.15)",
                  borderColor: "rgba(248,113,113,0.45)",
                  color: colors.danger,
                  fontWeight: 600,
                }}
                disabled={rotating}
                onClick={runRotate}
              >
                {rotating ? t.loading : t.myAgentsRotateConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newApiKey ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(360px, 100%)",
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>
              {t.myAgentsRotateDone}
            </p>
            <code
              style={{
                display: "block",
                padding: 10,
                borderRadius: 8,
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                fontSize: 12,
                wordBreak: "break-all",
                marginBottom: 12,
              }}
            >
              {newApiKey}
            </code>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={btnPrimary}
                onClick={() => {
                  void copyText(newApiKey).then((ok) => {
                    if (!ok) return;
                    setKeyCopied(true);
                    window.setTimeout(() => setKeyCopied(false), 2000);
                  });
                }}
              >
                {keyCopied ? t.myAgentsRotateCopied : t.myAgentsRotateCopy}
              </button>
              <button
                type="button"
                style={btnGhost}
                onClick={() => setNewApiKey(null)}
              >
                {t.myAgentsRotateDismiss}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
