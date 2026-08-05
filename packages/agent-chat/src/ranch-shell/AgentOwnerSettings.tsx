"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  if (m === "closed") return t.myAgentsPolicyClosed;
  if (m === "manifest") return t.myAgentsPolicyManifest;
  return mode?.trim() || t.unknown;
}

function boolLabel(v: boolean | null | undefined, t: RanchMessages): string {
  if (v === true) return t.yes;
  if (v === false) return t.no;
  return t.unknown;
}

function inboundLabel(detail: MyAgentSummary, t: RanchMessages): string {
  const applicable =
    detail.inbound_applicable ??
    (detail.delivery === "direct" ? true : detail.delivery ? false : null);
  if (applicable === false) return t.myAgentsInboundNa;
  return boolLabel(detail.inbound_reachable, t);
}

/** Lucide-style info glyph — sized via CSS, not emoji/unicode. */
function InfoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 10.5v5.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

/**
 * Standard info affordance: hover (or focus) shows a tip *above* the icon.
 * Touch devices can tap; tip is portaled so overflow panels don't clip it.
 */
export function FieldHint({
  text,
  align = "left",
}: {
  text: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    tipH: number;
  } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const tipWidth = 240;
  const hideTimer = useRef<number | null>(null);

  const clearHide = () => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const show = () => {
    clearHide();
    setOpen(true);
  };

  const scheduleHide = () => {
    clearHide();
    hideTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) {
      setCoords(null);
      return;
    }
    const place = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      const tipH = tipRef.current?.offsetHeight || 72;
      let left = align === "right" ? r.right - tipWidth : r.left + r.width / 2 - tipWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
      // Prefer above the icon.
      let top = r.top - tipH - 8;
      if (top < 8) top = r.bottom + 8;
      setCoords({ top, left, tipH });
    };
    place();
    // Re-measure after tip mounts with real height.
    const id = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align, text]);

  useEffect(() => () => clearHide(), []);

  const tip =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: "fixed",
              top: coords?.top ?? -9999,
              left: coords?.left ?? 0,
              zIndex: 10050,
              width: tipWidth,
              padding: "7px 9px",
              background: "#111827",
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.4,
              color: "rgba(226,232,240,0.95)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
              whiteSpace: "normal",
              textAlign: "left",
              fontWeight: 400,
              letterSpacing: "normal",
              textTransform: "none",
              pointerEvents: "auto",
              visibility: coords ? "visible" : "hidden",
            }}
          >
            {text}
          </div>,
          document.body,
        )
      : null;

  return (
    <span
      ref={wrapRef}
      style={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
        marginLeft: 4,
        verticalAlign: "middle",
      }}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        aria-label="More info"
        aria-describedby={open ? tipId : undefined}
        onFocus={show}
        onBlur={scheduleHide}
        onClick={(e) => {
          // Touch / keyboard fallback — desktop primarily uses hover.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          padding: 0,
          margin: 0,
          border: "none",
          background: "transparent",
          color: "rgba(148,163,184,0.7)",
          cursor: "help",
          lineHeight: 0,
        }}
      >
        <InfoIcon size={12} />
      </button>
      {tip}
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
  padding: "4px 0",
  fontSize: 13,
};

export function DetailRows({
  rows,
}: {
  rows: Array<{ label: string; value: string; hint?: string; valueHint?: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r) => {
        // One tip per row (prefer value-specific copy) to avoid icon clutter.
        const tip = r.valueHint || r.hint;
        return (
          <div key={r.label} style={rowStyle}>
            <span
              style={{
                color: colors.muted,
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                maxWidth: "48%",
              }}
            >
              {r.label}
              {tip ? <FieldHint text={tip} /> : null}
            </span>
            <span
              style={{
                textAlign: "right",
                wordBreak: "break-all",
                color: colors.text,
                minWidth: 0,
              }}
            >
              {r.value}
            </span>
          </div>
        );
      })}
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
  const [confirmRelay, setConfirmRelay] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(detail.name || "");
  const [descDraft, setDescDraft] = useState(detail.description || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  type DeliveryChoice = "direct" | "relay" | "none";
  const deliveryFromDetail = (d: string | null | undefined): DeliveryChoice => {
    if (d === "direct") return "direct";
    if (d === "relay") return "relay";
    return "none";
  };
  const [deliveryDraft, setDeliveryDraft] = useState<DeliveryChoice>(
    deliveryFromDetail(detail.delivery),
  );
  const [endpointDraft, setEndpointDraft] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);
  const [deliveryHint, setDeliveryHint] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(detail.name || "");
    setDescDraft(detail.description || "");
    setProfileMsg(null);
    setProfileError(null);
  }, [detail.agent_id, detail.name, detail.description]);

  useEffect(() => {
    setDeliveryDraft(deliveryFromDetail(detail.delivery));
    setEndpointDraft("");
    setDeliveryMsg(null);
    setDeliveryHint(null);
    setDeliveryError(null);
    setConfirmRelay(false);
  }, [detail.agent_id, detail.delivery]);

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

  const policyMode = (detail.policy_mode || "").toLowerCase();
  const deliveryEditable = !policyMode || policyMode === "open" || policyMode === "allowlist";
  const currentDelivery = deliveryFromDetail(detail.delivery);
  const deliveryDirty =
    deliveryDraft !== currentDelivery ||
    (deliveryDraft === "direct" && endpointDraft.trim().length > 0);
  const endpointTrim = endpointDraft.trim();
  const endpointLooksOk =
    endpointTrim.startsWith("https://") && endpointTrim.length > "https://".length;
  const canSaveDelivery =
    deliveryEditable &&
    deliveryDirty &&
    deliveryDraft !== "none" &&
    (deliveryDraft === "relay" || endpointLooksOk) &&
    !savingDelivery &&
    !busy;

  const saving = savingProfile || savingDelivery;
  const canSaveAny = (canSaveProfile || canSaveDelivery) && !saving && !busy;

  const runSaveProfile = (): Promise<MyAgentSummary | null> => {
    if (!canSaveProfile) return Promise.resolve(null);
    setSavingProfile(true);
    setProfileError(null);
    setProfileMsg(null);
    const patch: { name?: string; description?: string } = {};
    if (nameChanged) patch.name = nameTrim;
    if (descChanged && descTrim.length >= 10) patch.description = descTrim;
    if (!patch.name && !patch.description) {
      setSavingProfile(false);
      return Promise.resolve(null);
    }
    return client
      .updateMyAgentProfile(detail.agent_id, patch)
      .then((row) => {
        setProfileMsg(t.myAgentsProfileSaved);
        window.setTimeout(() => setProfileMsg(null), 2000);
        return row;
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChatGatewayError && err.message.trim()
            ? err.message.trim()
            : t.myAgentsProfileFailed;
        setProfileError(msg);
        return null;
      })
      .finally(() => setSavingProfile(false));
  };

  const runSaveDelivery = (): Promise<MyAgentSummary | null> => {
    if (!canSaveDelivery) return Promise.resolve(null);
    const mode = deliveryDraft;
    if (mode !== "direct" && mode !== "relay") return Promise.resolve(null);
    setConfirmRelay(false);
    setSavingDelivery(true);
    setDeliveryError(null);
    setDeliveryMsg(null);
    setDeliveryHint(null);
    const patch =
      mode === "relay"
        ? ({ delivery: "relay" as const })
        : ({ delivery: "direct" as const, endpoint: endpointTrim });
    return client
      .updateMyAgentDelivery(detail.agent_id, patch)
      .then((row) => {
        setDeliveryMsg(t.myAgentsDeliverySaved);
        setEndpointDraft("");
        if (row.next_step_hint?.trim()) setDeliveryHint(row.next_step_hint.trim());
        window.setTimeout(() => setDeliveryMsg(null), 2500);
        return row;
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChatGatewayError && err.message.trim()
            ? err.message.trim()
            : t.myAgentsDeliveryFailed;
        setDeliveryError(msg);
        return null;
      })
      .finally(() => setSavingDelivery(false));
  };

  const runSaveAll = () => {
    const doProfile = canSaveProfile;
    const doDelivery = canSaveDelivery;
    void (async () => {
      let latest: MyAgentSummary | null = null;
      if (doProfile) latest = (await runSaveProfile()) ?? latest;
      if (doDelivery) latest = (await runSaveDelivery()) ?? latest;
      if (latest) onUpdated?.(latest);
    })();
  };

  const saveAll = () => {
    if (!canSaveAny) return;
    // Clearing a public URL is destructive — confirm first.
    if (canSaveDelivery && currentDelivery === "direct" && deliveryDraft === "relay") {
      setConfirmRelay(true);
      return;
    }
    runSaveAll();
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

  const optionBtn = (active: boolean): CSSProperties => ({
    ...btnGhost,
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderColor: active ? "rgba(96,165,250,0.65)" : colors.border,
    background: active ? "rgba(59,130,246,0.12)" : "transparent",
    color: colors.text,
    display: "block",
  });

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
            disabled={busy || saving}
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
            disabled={busy || saving}
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
      </section>

      {showConnectSection ? (
        <section>
          <h3 style={sectionTitle}>{t.myAgentsSectionConnect}</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            {t.myAgentsDeliveryChoose}
            <FieldHint text={t.myAgentsDeliveryHint} />
          </p>
          {!deliveryEditable ? (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              {t.myAgentsDeliveryLocked}
            </p>
          ) : null}
          {currentDelivery === "none" ? (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              <strong style={{ color: colors.text }}>{t.myAgentsDeliveryUnset}. </strong>
              {t.myAgentsDeliveryUnsetHelp}
            </p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={optionBtn(deliveryDraft === "relay")}
              disabled={!deliveryEditable || saving || busy}
              onClick={() => setDeliveryDraft("relay")}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsDeliveryOptionPull}</div>
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 4, lineHeight: 1.4 }}>
                {t.myAgentsDeliveryPullHelp}
              </div>
            </button>
            <button
              type="button"
              style={optionBtn(deliveryDraft === "direct")}
              disabled={!deliveryEditable || saving || busy}
              onClick={() => setDeliveryDraft("direct")}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsDeliveryOptionPush}</div>
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 4, lineHeight: 1.4 }}>
                {t.myAgentsDeliveryPushHelp}
              </div>
            </button>
          </div>
          {deliveryDraft === "direct" ? (
            <label style={{ display: "block", marginTop: 10 }}>
              <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>
                {t.myAgentsEndpointInput}
                <FieldHint text={t.myAgentsEndpointHint} />
              </div>
              <input
                value={endpointDraft}
                onChange={(e) => setEndpointDraft(e.target.value)}
                placeholder={t.myAgentsEndpointPlaceholder}
                style={inputStyle}
                disabled={!deliveryEditable || saving || busy}
                autoComplete="off"
                spellCheck={false}
              />
              {detail.endpoint_masked || currentDelivery === "direct" ? (
                <div style={{ fontSize: 11, color: colors.muted, marginTop: 4, lineHeight: 1.4 }}>
                  {detail.endpoint_masked
                    ? `${t.myAgentsEndpoint}: ${detail.endpoint_masked}. `
                    : null}
                  {t.myAgentsEndpointReenterHint}
                </div>
              ) : null}
            </label>
          ) : null}
          {detail.delivery === "direct" ? (
            <div style={{ marginTop: 10 }}>
              <DetailRows
                rows={[
                  {
                    label: t.myAgentsInbound,
                    hint: t.myAgentsInboundHint,
                    value: inboundLabel(detail, t),
                  },
                ]}
              />
            </div>
          ) : null}
          {deliveryError ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.danger }}>{deliveryError}</p>
          ) : null}
          {deliveryMsg ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.recommended }}>
              {deliveryMsg}
            </p>
          ) : null}
          {deliveryHint ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
              {deliveryHint}
            </p>
          ) : null}
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
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rotateError ? (
          <p style={{ margin: 0, fontSize: 12, color: colors.danger }}>{rotateError}</p>
        ) : null}
        <button
          type="button"
          style={{ ...btnPrimary, width: "100%" }}
          disabled={!canSaveAny}
          onClick={saveAll}
        >
          {saving ? t.loading : t.save}
        </button>
        <button
          type="button"
          style={{
            ...btnGhost,
            width: "100%",
            borderColor: "rgba(248,113,113,0.45)",
            color: colors.danger,
          }}
          disabled={busy || rotating || saving}
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

      {confirmRelay ? (
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
            if (!savingDelivery) setConfirmRelay(false);
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
              {t.myAgentsDeliveryRelayConfirm}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={btnGhost}
                disabled={savingDelivery}
                onClick={() => setConfirmRelay(false)}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                style={{ ...btnPrimary, fontWeight: 600 }}
                disabled={saving}
                onClick={runSaveAll}
              >
                {saving ? t.loading : t.myAgentsDeliveryRelayConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
