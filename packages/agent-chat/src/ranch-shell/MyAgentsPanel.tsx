"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { GatewayClient, MyAgentSummary } from "../gateway";
import {
  AgentOwnerSettings,
  DetailRows,
  deliveryLabel,
} from "./AgentOwnerSettings";
import { AgentOwnerWallet } from "./AgentOwnerWallet";
import { copyConnectPromptWithInvite } from "./connectPrompt";
import type { RanchLocale, RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

type Props = {
  client: GatewayClient;
  connectGuideUrl?: string;
  /** AgentPlanet origin for wallet recharge deep-link. Default https://agentplanet.org */
  agentPlanetBaseUrl?: string;
  /** Public Interfaze origin for gift accept links. Default https://interfaze.io */
  interfazeBaseUrl?: string;
  locale: RanchLocale;
  messages: RanchMessages;
  busy?: boolean;
  onClose: () => void;
  onConnectExisting?: () => void;
  /** Open hosted-agent create on the current shell, not this panel. */
  onCreateHosted?: () => void;
  onOpenChat: (agentId: string) => void;
  /** Notify shell/host after a successful profile save (for chat title / directory). */
  onAgentUpdated?: (agent: MyAgentSummary, previousName?: string | null) => void;
  /** After permanent delete — leave detail and refresh list. */
  onAgentRemoved?: (agentId: string) => void;
};

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

export function MyAgentsPanel({
  client,
  connectGuideUrl,
  agentPlanetBaseUrl = "https://agentplanet.org",
  interfazeBaseUrl = "https://interfaze.io",
  locale,
  messages: t,
  busy,
  onClose,
  onConnectExisting,
  onCreateHosted,
  onOpenChat,
  onAgentUpdated,
  onAgentRemoved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<MyAgentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyAgentSummary | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createAvailable, setCreateAvailable] = useState<boolean | null>(null);

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
    let cancelled = false;
    void client
      .getAgentCreateAvailability()
      .then((row) => {
        if (!cancelled) setCreateAvailable(row.available === true);
      })
      .catch(() => {
        if (!cancelled) setCreateAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
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
    void copyConnectPromptWithInvite(
      locale,
      () => client.createJoinInvite(),
      interfazeBaseUrl,
    ).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
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
        {!selectedId ? (
          <div style={{ display: "flex", gap: 6 }}>
            {createAvailable ? (
              <button type="button" style={btnPrimary} onClick={() => onCreateHosted?.()}>
                {t.createAgent}
              </button>
            ) : null}
            <button
              type="button"
              style={btnGhost}
              onClick={() => onConnectExisting?.()}
            >
              {t.connectExisting}
            </button>
          </div>
        ) : (
          <span style={{ width: 40 }} />
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: selectedId ? 16 : 0 }}>
        {selectedId ? (
          detailLoading && !detail ? (
            <p style={{ color: colors.muted, fontSize: 13, padding: 16 }}>{t.loading}</p>
          ) : detail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section>
                <h3 style={sectionTitle}>{t.myAgentsSectionOverview}</h3>
                <DetailRows
                  rows={[
                    {
                      label: t.statusLabel,
                      value: detail.status === "online" ? t.online : t.offline,
                    },
                    { label: t.myAgentsShortId, value: detail.agent_id },
                    {
                      label: "Claim",
                      value: detail.claim_status || t.unknown,
                    },
                    ...(detail.last_heartbeat
                      ? [
                          {
                            label: t.myAgentsLastHeartbeat,
                            hint: t.myAgentsLastHeartbeatHint,
                            value: detail.last_heartbeat,
                          },
                        ]
                      : []),
                    ...(detail.tags && detail.tags.length > 0
                      ? [{ label: t.myAgentsTagsLabel, value: detail.tags.join(", ") }]
                      : []),
                  ]}
                />
              </section>
              <AgentOwnerSettings
                client={client}
                detail={detail}
                messages={t}
                agentPlanetBaseUrl={agentPlanetBaseUrl}
                interfazeBaseUrl={interfazeBaseUrl}
                connectGuideUrl={connectGuideUrl}
                busy={busy}
                onUpdated={(row) => {
                  const previousName = detail.name;
                  setDetail(row);
                  setAgents((prev) =>
                    prev.map((a) => (a.agent_id === row.agent_id ? { ...a, ...row } : a)),
                  );
                  onAgentUpdated?.(row, previousName);
                }}
                onRemoved={(agentId) => {
                  setAgents((prev) =>
                    prev.filter(
                      (a) =>
                        a.agent_id !== agentId &&
                        a.agent_id.replace(/^acn:/i, "") !== agentId.replace(/^acn:/i, ""),
                    ),
                  );
                  setSelectedId(null);
                  setDetail(null);
                  onAgentRemoved?.(agentId);
                }}
              />
              <AgentOwnerWallet
                client={client}
                agentId={detail.agent_id.replace(/^acn:/i, "")}
                messages={t}
                agentPlanetBaseUrl={agentPlanetBaseUrl}
                busy={busy}
              />
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
              {createAvailable ? (
                <button type="button" style={btnPrimary} onClick={() => onCreateHosted?.()}>
                  {t.createAgent}
                </button>
              ) : null}
              <button
                type="button"
                style={btnGhost}
                onClick={() => onConnectExisting?.()}
              >
                {t.connectExisting}
              </button>
              <button type="button" style={btnGhost} onClick={copyPrompt}>
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
    </div>
  );
}
