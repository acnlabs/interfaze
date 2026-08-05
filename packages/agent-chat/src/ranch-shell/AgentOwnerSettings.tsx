"use client";

import { useState, type CSSProperties } from "react";
import type { GatewayClient, MyAgentSummary } from "../gateway";
import { copyText } from "./connectPrompt";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

export function deliveryLabel(
  delivery: string | null | undefined,
  t: RanchMessages,
): string {
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

export function DetailRows({
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

type Props = {
  client: GatewayClient;
  detail: MyAgentSummary;
  messages: RanchMessages;
  agentPlanetBaseUrl?: string;
  connectGuideUrl?: string;
  busy?: boolean;
  /** When false, hide Connect section (Info already shows Mode summary). */
  showConnectSection?: boolean;
};

/**
 * Owner Settings: connect details + rotate-key + gift deep-link.
 * Shared by MyAgentsPanel detail and conversation Settings tab.
 */
export function AgentOwnerSettings({
  client,
  detail,
  messages: t,
  agentPlanetBaseUrl = "https://agentplanet.org",
  connectGuideUrl,
  busy,
  showConnectSection = true,
}: Props) {
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const giftUrl = `${agentPlanetBaseUrl.replace(/\/+$/, "")}/agents/${encodeURIComponent(detail.agent_id)}`;

  const runRotate = () => {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
      {showConnectSection ? (
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
      ) : null}

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
          <p style={{ margin: "10px 0 0", fontSize: 12, color: colors.danger }}>{rotateError}</p>
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
        </div>
      </section>

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
            position: "fixed",
            inset: 0,
            zIndex: 130,
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
              <button type="button" style={btnGhost} onClick={() => setNewApiKey(null)}>
                {t.myAgentsRotateDismiss}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
