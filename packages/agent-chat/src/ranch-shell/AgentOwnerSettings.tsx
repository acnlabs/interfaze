"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ChatGatewayError, type GatewayClient, type MyAgentSummary } from "../gateway";
import { copyText } from "./connectPrompt";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors, inputStyle } from "./styles";

/** Align with ACN / Gateway display-name rules (letter required). */
function nameLooksValid(name: string): boolean {
  const v = name.trim();
  if (v.length < 2 || v.length > 100) return false;
  if (/[-_]\d{8,}$/.test(v)) return false;
  return /[a-zA-Z\u4e00-\u9fff]/.test(v);
}

export function deliveryLabel(
  delivery: string | null | undefined,
  t: RanchMessages,
): string {
  if (delivery === "direct") return t.myAgentsDeliveryDirect;
  if (delivery === "relay") return t.myAgentsDeliveryRelay;
  if (delivery === "none") return t.myAgentsDeliveryNone;
  return t.unknown;
}

export function deliveryValueHint(
  delivery: string | null | undefined,
  t: RanchMessages,
): string | undefined {
  if (delivery === "direct") return t.myAgentsDeliveryDirectHint;
  if (delivery === "relay") return t.myAgentsDeliveryRelayHint;
  if (delivery === "none") return t.myAgentsDeliveryNoneHint;
  return undefined;
}

export function policyLabel(
  mode: string | null | undefined,
  t: RanchMessages,
): string {
  const m = (mode || "").toLowerCase();
  if (m === "open") return t.myAgentsPolicyOpen;
  if (m === "allowlist") return t.myAgentsPolicyAllowlist;
  return mode?.trim() || t.unknown;
}

function boolLabel(v: boolean | null | undefined, t: RanchMessages): string {
  if (v === true) return t.yes;
  if (v === false) return t.no;
  return t.unknown;
}

/** Compact help affordance — full text in native tooltip. */
export function FieldHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        marginLeft: 4,
        borderRadius: "50%",
        border: `1px solid ${colors.muted}`,
        fontSize: 10,
        lineHeight: "14px",
        color: colors.muted,
        cursor: "help",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      ?
    </span>
  );
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
  rows: Array<{ label: string; value: string; hint?: string; valueHint?: string }>;
}) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} style={rowStyle}>
          <span
            style={{
              color: colors.muted,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              maxWidth: "46%",
            }}
          >
            {r.label}
            {r.hint ? <FieldHint text={r.hint} /> : null}
          </span>
          <span
            style={{
              textAlign: "right",
              wordBreak: "break-all",
              color: colors.text,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
              minWidth: 0,
            }}
          >
            <span style={{ minWidth: 0 }}>{r.value}</span>
            {r.valueHint ? <FieldHint text={r.valueHint} /> : null}
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
  /** When false, hide receiving-messages section (Info already shows a summary). */
  showConnectSection?: boolean;
  /** Called after a successful profile save with refreshed detail. */
  onUpdated?: (detail: MyAgentSummary) => void;
};

/**
 * Owner Settings: profile edit + connect details + rotate-key + gift.
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
  onUpdated,
}: Props) {
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(detail.name || "");
  const [descDraft, setDescDraft] = useState(detail.description || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(detail.name || "");
    setDescDraft(detail.description || "");
    setProfileMsg(null);
    setProfileError(null);
  }, [detail.agent_id, detail.name, detail.description]);

  const giftUrl = `${agentPlanetBaseUrl.replace(/\/+$/, "")}/agents/${encodeURIComponent(detail.agent_id)}`;

  const nameTrim = nameDraft.trim();
  const descTrim = descDraft.trim();
  const oldName = (detail.name || "").trim();
  const oldDesc = (detail.description || "").trim();
  const nameChanged = nameTrim !== oldName;
  const descChanged = descTrim !== oldDesc;
  const nameOk = nameLooksValid(nameTrim);
  // ACN rejects description shorter than 10; empty means "leave unchanged", not clear.
  const descOk = descTrim.length === 0 || (descTrim.length >= 10 && descTrim.length <= 500);
  const clearingDesc = descChanged && descTrim.length === 0 && oldDesc.length > 0;
  const profileDirty = nameChanged || (descChanged && !clearingDesc);
  const canSaveProfile =
    profileDirty &&
    nameOk &&
    descOk &&
    (nameChanged || descTrim.length >= 10) &&
    !savingProfile &&
    !busy;

  const saveProfile = () => {
    if (!canSaveProfile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileMsg(null);
    const patch: { name?: string; description?: string } = {};
    if (nameChanged) patch.name = nameTrim;
    if (descChanged && descTrim.length >= 10) patch.description = descTrim;
    if (!patch.name && !patch.description) {
      setSavingProfile(false);
      return;
    }
    void client
      .updateMyAgentProfile(detail.agent_id, patch)
      .then((row) => {
        setProfileMsg(t.myAgentsProfileSaved);
        onUpdated?.(row);
        window.setTimeout(() => setProfileMsg(null), 2000);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChatGatewayError && err.message.trim()
            ? err.message.trim()
            : t.myAgentsProfileFailed;
        setProfileError(msg);
      })
      .finally(() => setSavingProfile(false));
  };

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
      <section>
        <h3 style={sectionTitle}>{t.myAgentsSectionIdentity}</h3>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>
            {t.myAgentsNameLabel}
          </div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            style={inputStyle}
            maxLength={100}
            disabled={busy || savingProfile}
          />
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
            {t.myAgentsNameHint}
          </div>
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>
            {t.myAgentsDescLabel}
          </div>
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
            maxLength={500}
            disabled={busy || savingProfile}
          />
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
            {clearingDesc ? t.myAgentsDescClearHint : t.myAgentsDescHint}
          </div>
        </label>
        {profileError ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.danger }}>{profileError}</p>
        ) : null}
        {profileMsg ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.recommended }}>{profileMsg}</p>
        ) : null}
        <button
          type="button"
          style={{ ...btnPrimary, width: "100%" }}
          disabled={!canSaveProfile}
          onClick={saveProfile}
        >
          {savingProfile ? t.loading : t.myAgentsSaveProfile}
        </button>
      </section>

      {showConnectSection ? (
        <section>
          <h3 style={sectionTitle}>{t.myAgentsSectionConnect}</h3>
          <DetailRows
            rows={[
              {
                label: t.myAgentsDelivery,
                hint: t.myAgentsDeliveryHint,
                value: deliveryLabel(detail.delivery, t),
                valueHint: deliveryValueHint(detail.delivery, t),
              },
              {
                label: t.myAgentsEndpoint,
                hint: t.myAgentsEndpointHint,
                value: detail.endpoint_masked || "—",
              },
              {
                label: t.myAgentsInbound,
                hint: t.myAgentsInboundHint,
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
              hint: t.myAgentsPolicyHint,
              value: policyLabel(detail.policy_mode, t),
            },
            {
              label: t.myAgentsChatOpen,
              hint: t.myAgentsChatOpenHint,
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
