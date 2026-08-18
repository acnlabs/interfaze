"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  ChatGatewayError,
  type ChatAgentSearchHit,
  type GatewayClient,
  type MyAgentAllowlistEntry,
  type MyAgentSummary,
} from "../gateway";
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

/** Parse comma-separated tags; dedupe, cap at 20 (ACN profile list max). */
function parseTagsInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,，]/)) {
    const t = part.trim();
    if (!t || t.length > 40) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

function tagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t === b[i]);
}

function formatTagsInput(tags: string[] | null | undefined): string {
  return (tags ?? []).join(", ");
}

const FALLBACK_MODEL_ID = "openai/gpt-4o-mini";
const DEFAULT_MARKUP_PERCENT = 50;

function roundUsdPerMillion(n: number): number {
  // Keep enough precision for cheap models without noisy floats.
  return Math.round(n * 1e6) / 1e6;
}

function applyMarkup(catalog: number, markupPercent: number): number {
  return roundUsdPerMillion(catalog * (1 + markupPercent / 100));
}

function sameModelId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function resolvePricingModelId(detail: MyAgentSummary): string {
  // Saved listing wins; else runtime heartbeat report; else catalog default.
  const listed = (detail.token_pricing?.model_id || "").trim();
  if (listed) return listed;
  const runtime = (detail.runtime_model_id || "").trim();
  if (runtime) return runtime;
  const preferred = (detail.preferred_model_id || "").trim();
  if (preferred) return preferred;
  return FALLBACK_MODEL_ID;
}

/** 1 Credit = $0.10 — same default as Host ``credit_to_usd_rate``. */
const CREDIT_TO_USD = 0.1;

function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.max(0, Math.ceil(roundUsdPerMillion(usd) / CREDIT_TO_USD - 1e-12));
}

function uniqModelIds(...groups: Array<Array<string | null | undefined> | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const raw of group || []) {
      const id = (raw || "").trim();
      if (!id) continue;
      const key = id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(id);
    }
  }
  return out;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return roundUsdPerMillion(n).toFixed(6);
}

function shortModelLabel(modelId: string): string {
  const s = modelId.trim();
  const slash = s.lastIndexOf("/");
  return slash >= 0 ? s.slice(slash + 1) : s;
}

function catalogOptionLabel(
  id: string,
  pair: { in: number; out: number } | undefined,
): string {
  const name = shortModelLabel(id) || id;
  if (!pair) return name;
  return `${name} · ${fmtUsd(pair.in)} / ${fmtUsd(pair.out)}`;
}

function fillTemplate(
  tmpl: string,
  vars: Record<string, string | number>,
): string {
  let out = tmpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(String(v));
  }
  return out;
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
  /** Public host for gift accept links. Default https://interfaze.io */
  interfazeBaseUrl?: string;
  connectGuideUrl?: string;
  busy?: boolean;
  /** When false, hide receiving-messages section (Info already shows a summary). */
  showConnectSection?: boolean;
  /** Called after a successful profile save with refreshed detail. */
  onUpdated?: (detail: MyAgentSummary) => void;
  /** Called after permanent delete succeeds. */
  onRemoved?: (agentId: string) => void;
};

/**
 * Owner Settings: profile edit + connect details + rotate-key + gift + delete.
 * Shared by MyAgentsPanel detail and conversation Settings tab.
 * (ACN release/unclaim stays on AgentPlanet — not an Interfaze job.)
 */
export function AgentOwnerSettings({
  client,
  detail,
  messages: t,
  // Kept for call-site compatibility (wallet / external deep-links live elsewhere).
  agentPlanetBaseUrl: _agentPlanetBaseUrl = "https://agentplanet.org",
  interfazeBaseUrl = "https://interfaze.io",
  connectGuideUrl,
  busy,
  showConnectSection = true,
  onUpdated,
  onRemoved,
}: Props) {
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmRelay, setConfirmRelay] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftUrl, setGiftUrl] = useState<string | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftCopied, setGiftCopied] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(detail.name || "");
  const [descDraft, setDescDraft] = useState(detail.description || "");
  const [tagsDraft, setTagsDraft] = useState(formatTagsInput(detail.tags));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [modelIdDraft, setModelIdDraft] = useState(() => resolvePricingModelId(detail));
  const [supportedModels, setSupportedModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [markupDraft, setMarkupDraft] = useState(() => {
    const mu = detail.token_pricing?.markup_percent;
    if (typeof mu === "number" && Number.isFinite(mu) && mu >= 0) return String(mu);
    return String(DEFAULT_MARKUP_PERCENT);
  });
  const [catalogById, setCatalogById] = useState<
    Record<string, { in: number; out: number }>
  >({});
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingMsg, setPricingMsg] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
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
  type PolicyChoice = "open" | "allowlist" | "closed";
  const policyFromDetail = (m: string | null | undefined): PolicyChoice | "manifest" | "other" => {
    const v = (m || "").toLowerCase();
    if (v === "open" || v === "allowlist" || v === "closed" || v === "manifest") return v;
    return v ? "other" : "open";
  };
  const editablePolicy = (m: string | null | undefined): PolicyChoice | null => {
    const cur = policyFromDetail(m);
    return cur === "open" || cur === "allowlist" || cur === "closed" ? cur : null;
  };
  // null = no pending change (used when current mode is manifest/other).
  const [policyDraft, setPolicyDraft] = useState<PolicyChoice | null>(() =>
    editablePolicy(detail.policy_mode),
  );
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const [allowlist, setAllowlist] = useState<MyAgentAllowlistEntry[]>([]);
  const [allowlistTotal, setAllowlistTotal] = useState(0);
  const [allowlistLoading, setAllowlistLoading] = useState(false);
  const [allowlistError, setAllowlistError] = useState<string | null>(null);
  const [allowlistDraft, setAllowlistDraft] = useState("");
  const [allowlistActing, setAllowlistActing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [allowlistHits, setAllowlistHits] = useState<ChatAgentSearchHit[]>([]);
  const [allowlistSearching, setAllowlistSearching] = useState(false);
  const [confirmClosedPolicy, setConfirmClosedPolicy] = useState(false);

  useEffect(() => {
    setNameDraft(detail.name || "");
    setDescDraft(detail.description || "");
    setTagsDraft(formatTagsInput(detail.tags));
    setProfileMsg(null);
    setProfileError(null);
  }, [detail.agent_id, detail.name, detail.description, detail.tags?.join("\u0001")]);

  useEffect(() => {
    setModelIdDraft(resolvePricingModelId(detail));
    const mu = detail.token_pricing?.markup_percent;
    setMarkupDraft(
      typeof mu === "number" && Number.isFinite(mu) && mu >= 0
        ? String(mu)
        : String(DEFAULT_MARKUP_PERCENT),
    );
    setPricingMsg(null);
    setPricingError(null);
  }, [
    detail.agent_id,
    detail.token_pricing?.model_id,
    detail.token_pricing?.markup_percent,
    detail.preferred_model_id,
    detail.runtime_model_id,
  ]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    client
      .getAgentModelStatus(detail.agent_id)
      .then((status) => {
        if (cancelled) return;
        const ids = uniqModelIds(
          status.supported_models,
          [detail.token_pricing?.model_id],
          [detail.runtime_model_id],
        );
        setSupportedModels(ids);
        const current = resolvePricingModelId(detail);
        if (ids.length > 0 && !ids.some((id) => id.toLowerCase() === current.toLowerCase())) {
          setModelIdDraft(ids[0]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSupportedModels(
          uniqModelIds([detail.token_pricing?.model_id], [detail.runtime_model_id]),
        );
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, detail.agent_id, detail.token_pricing?.model_id, detail.runtime_model_id]);

  const supportedKey = supportedModels.join("\u0001");
  useEffect(() => {
    if (supportedModels.length === 0) {
      setCatalogById({});
      setCatalogLoading(false);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    void Promise.all(
      supportedModels.map((id) =>
        client.getModelCatalogItem(id).then(
          (row) => {
            const cin = Number(row.input_price_per_million);
            const cout = Number(row.output_price_per_million);
            if (!Number.isFinite(cin) || !Number.isFinite(cout)) return [id, null] as const;
            return [id, { in: cin, out: cout }] as const;
          },
          () => [id, null] as const,
        ),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, { in: number; out: number }> = {};
      for (const [id, pair] of rows) {
        if (pair) next[id] = pair;
      }
      setCatalogById(next);
      setCatalogLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [client, supportedKey]);

  useEffect(() => {
    setDeliveryDraft(deliveryFromDetail(detail.delivery));
    setEndpointDraft("");
    setDeliveryMsg(null);
    setDeliveryHint(null);
    setDeliveryError(null);
    setConfirmRelay(false);
  }, [detail.agent_id, detail.delivery]);

  useEffect(() => {
    setPolicyDraft(editablePolicy(detail.policy_mode));
    setPolicyMsg(null);
    setPolicyError(null);
    setConfirmClosedPolicy(false);
  }, [detail.agent_id, detail.policy_mode]);

  useEffect(() => {
    setGiftOpen(false);
    setGiftUrl(null);
    setGiftBusy(false);
    setGiftCopied(false);
    setGiftError(null);
  }, [detail.agent_id]);

  const nameTrim = nameDraft.trim();
  const descTrim = descDraft.trim();
  const oldName = (detail.name || "").trim();
  const oldDesc = (detail.description || "").trim();
  const oldTags = detail.tags ?? [];
  const tagsParsed = parseTagsInput(tagsDraft);
  const nameChanged = nameTrim !== oldName;
  const descChanged = descTrim !== oldDesc;
  const tagsChanged = !tagsEqual(tagsParsed, oldTags);
  const nameOk = nameLooksValid(nameTrim);
  // ACN rejects description shorter than 10; empty means "leave unchanged", not clear.
  const descOk = descTrim.length === 0 || (descTrim.length >= 10 && descTrim.length <= 500);
  const clearingDesc = descChanged && descTrim.length === 0 && oldDesc.length > 0;
  const profileDirty = nameChanged || (descChanged && !clearingDesc) || tagsChanged;
  const canSaveProfile =
    profileDirty &&
    nameOk &&
    descOk &&
    (nameChanged || (descChanged && descTrim.length >= 10) || tagsChanged) &&
    !savingProfile &&
    !busy;

  const oldModelId = (detail.token_pricing?.model_id || "").trim();
  const oldMarkup = detail.token_pricing?.markup_percent;
  const modelIdTrim = modelIdDraft.trim();
  const markupParsed = (() => {
    const n = Number(markupDraft);
    return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null;
  })();
  const listingPublished =
    oldModelId.length > 0 && typeof oldMarkup === "number" && Number.isFinite(oldMarkup);
  const selectedCatalog =
    catalogById[modelIdTrim] ??
    Object.entries(catalogById).find(([id]) => sameModelId(id, modelIdTrim))?.[1] ??
    null;
  const catalogIn = selectedCatalog?.in ?? null;
  const catalogOut = selectedCatalog?.out ?? null;
  const catalogError =
    !modelsLoading &&
    !catalogLoading &&
    supportedModels.length > 0 &&
    modelIdTrim.length > 0 &&
    selectedCatalog == null
      ? t.myAgentsPricingCatalogMissing
      : null;
  const inputParsed =
    !catalogLoading && catalogIn != null && !catalogError && markupParsed != null
      ? applyMarkup(catalogIn, markupParsed)
      : null;
  const outputParsed =
    !catalogLoading && catalogOut != null && !catalogError && markupParsed != null
      ? applyMarkup(catalogOut, markupParsed)
      : null;
  const previewReady = inputParsed != null && outputParsed != null;
  const pricingDirty =
    modelIdTrim.length > 0 &&
    markupParsed !== null &&
    (!listingPublished ||
      !sameModelId(modelIdTrim, oldModelId) ||
      markupParsed !== oldMarkup);
  const runtimeId = (detail.runtime_model_id || "").trim();
  const runtimeMismatch = Boolean(runtimeId && !sameModelId(runtimeId, modelIdTrim));
  const modelOnList =
    supportedModels.length > 0 &&
    supportedModels.some((id) => id.toLowerCase() === modelIdTrim.toLowerCase());
  const canSavePricing =
    pricingDirty &&
    previewReady &&
    inputParsed !== null &&
    outputParsed !== null &&
    markupParsed !== null &&
    modelIdTrim.length > 0 &&
    modelOnList &&
    !modelsLoading &&
    !savingPricing &&
    !busy;

  const policyMode = (detail.policy_mode || "").toLowerCase();
  const currentPolicy = policyFromDetail(detail.policy_mode);
  // Delivery edits use the *saved* policy (not draft) — ACN rejects push when closed.
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

  const savedPolicy = editablePolicy(detail.policy_mode);
  const selectedPolicy = policyDraft ?? savedPolicy;
  const policyDirty = policyDraft !== null && policyDraft !== savedPolicy;
  const canSavePolicy = policyDirty && !savingPolicy && !busy;
  const showAllowlistEditor =
    selectedPolicy === "allowlist" || savedPolicy === "allowlist";

  const loadAllowlist = useCallback(async () => {
    setAllowlistLoading(true);
    setAllowlistError(null);
    try {
      const data = await client.listMyAgentAllowlist(detail.agent_id);
      setAllowlist(data.entries ?? []);
      setAllowlistTotal(data.total ?? (data.entries ?? []).length);
    } catch {
      setAllowlist([]);
      setAllowlistTotal(0);
      setAllowlistError(t.myAgentsAllowlistLoadFailed);
    } finally {
      setAllowlistLoading(false);
    }
  }, [client, detail.agent_id, t.myAgentsAllowlistLoadFailed]);

  useEffect(() => {
    if (!showAllowlistEditor) return;
    void loadAllowlist();
  }, [showAllowlistEditor, loadAllowlist]);

  useEffect(() => {
    if (!showAllowlistEditor) {
      setAllowlistHits([]);
      setAllowlistSearching(false);
      return;
    }
    const q = allowlistDraft.trim();
    if (q.length < 2) {
      setAllowlistHits([]);
      setAllowlistSearching(false);
      return;
    }
    let cancelled = false;
    setAllowlistSearching(true);
    const handle = window.setTimeout(() => {
      void client
        .searchAgents(q, 8)
        .then((hits) => {
          if (cancelled) return;
          const onList = new Set(allowlist.map((e) => e.target_id));
          setAllowlistHits(
            (hits ?? []).filter(
              (h) => h.agent_id !== detail.agent_id && !onList.has(h.agent_id),
            ),
          );
        })
        .catch(() => {
          if (!cancelled) setAllowlistHits([]);
        })
        .finally(() => {
          if (!cancelled) setAllowlistSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [allowlistDraft, showAllowlistEditor, client, detail.agent_id, allowlist]);

  const addAllowlistMember = async (targetOverride?: string) => {
    if (allowlistActing) return;
    const target = (targetOverride ?? allowlistDraft).trim();
    if (!target || target.length > 128) {
      setAllowlistError(t.myAgentsAllowlistInvalidId);
      return;
    }
    if (target === detail.agent_id) {
      setAllowlistError(t.myAgentsAllowlistSelf);
      return;
    }
    setAllowlistActing(true);
    setAllowlistError(null);
    try {
      await client.addMyAgentAllowlistMember(detail.agent_id, target);
      setAllowlistDraft("");
      setAllowlistHits([]);
      await loadAllowlist();
    } catch (e) {
      const code = e instanceof ChatGatewayError ? e.code : "";
      if (code === "rate_limited") setAllowlistError(t.myAgentsAllowlistFull);
      else if (code === "agent_not_found") setAllowlistError(t.myAgentsAllowlistAddFailed);
      else if (code === "invalid_request") setAllowlistError(t.myAgentsAllowlistInvalidId);
      else setAllowlistError(t.myAgentsAllowlistAddFailed);
    } finally {
      setAllowlistActing(false);
    }
  };

  const removeAllowlistMember = async (targetId: string) => {
    if (allowlistActing) return;
    setAllowlistActing(true);
    setRemovingId(targetId);
    setAllowlistError(null);
    try {
      await client.removeMyAgentAllowlistMember(detail.agent_id, targetId);
      await loadAllowlist();
    } catch {
      setAllowlistError(t.myAgentsAllowlistRemoveFailed);
    } finally {
      setAllowlistActing(false);
      setRemovingId(null);
    }
  };

  const saving = savingProfile || savingDelivery || savingPolicy || savingPricing;
  const hasEdits = profileDirty || deliveryDirty || policyDirty || pricingDirty;
  const canSaveAny =
    (canSaveProfile || canSaveDelivery || canSavePolicy) &&
    !savingProfile &&
    !savingDelivery &&
    !savingPolicy &&
    !busy;

  const runSaveProfile = (): Promise<MyAgentSummary | null> => {
    if (!canSaveProfile) return Promise.resolve(null);
    setSavingProfile(true);
    setProfileError(null);
    setProfileMsg(null);
    const patch: { name?: string; description?: string; tags?: string[] } = {};
    if (nameChanged) patch.name = nameTrim;
    if (descChanged && descTrim.length >= 10) patch.description = descTrim;
    if (tagsChanged) patch.tags = tagsParsed;
    if (!patch.name && !patch.description && patch.tags === undefined) {
      setSavingProfile(false);
      return Promise.resolve(null);
    }
    return client
      .updateMyAgentProfile(detail.agent_id, patch)
      .then((row) => {
        setProfileMsg(t.myAgentsProfileSaved);
        setTagsDraft(formatTagsInput(row.tags));
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

  const runSavePricing = (): Promise<MyAgentSummary | null> => {
    if (
      !canSavePricing ||
      inputParsed === null ||
      outputParsed === null ||
      markupParsed === null ||
      !modelIdTrim
    ) {
      return Promise.resolve(null);
    }
    setSavingPricing(true);
    setPricingError(null);
    setPricingMsg(null);
    return client
      .updateMyAgentTokenPricing(detail.agent_id, {
        input_price_per_million: inputParsed,
        output_price_per_million: outputParsed,
        model_id: modelIdTrim,
        markup_percent: markupParsed,
      })
      .then((row) => {
        setPricingMsg(t.myAgentsPricingSaved);
        setModelIdDraft(resolvePricingModelId(row));
        const mu = row.token_pricing?.markup_percent;
        if (typeof mu === "number" && Number.isFinite(mu)) setMarkupDraft(String(mu));
        window.setTimeout(() => setPricingMsg(null), 2000);
        onUpdated?.(row);
        return row;
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChatGatewayError && err.message.trim()
            ? err.message.trim()
            : t.myAgentsPricingFailed;
        setPricingError(msg);
        return null;
      })
      .finally(() => setSavingPricing(false));
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

  const runSavePolicy = (): Promise<MyAgentSummary | null> => {
    if (!canSavePolicy || !policyDraft) return Promise.resolve(null);
    setConfirmClosedPolicy(false);
    setSavingPolicy(true);
    setPolicyError(null);
    setPolicyMsg(null);
    const mode = policyDraft;
    return client
      .updateMyAgentPolicy(detail.agent_id, { mode })
      .then((row) => {
        setPolicyMsg(t.myAgentsPolicySaved);
        window.setTimeout(() => setPolicyMsg(null), 2500);
        return row;
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChatGatewayError && err.message.trim()
            ? err.message.trim()
            : t.myAgentsPolicyFailed;
        setPolicyError(msg);
        return null;
      })
      .finally(() => setSavingPolicy(false));
  };

  const runSaveAll = () => {
    const doProfile = canSaveProfile;
    const doDelivery = canSaveDelivery;
    const doPolicy = canSavePolicy;
    // Opening policy before delivery so push/pull can succeed; closing after.
    const openingPolicy = doPolicy && policyDraft === "open";
    const otherPolicy = doPolicy && policyDraft !== "open";
    void (async () => {
      let latest: MyAgentSummary | null = null;
      if (doProfile) latest = (await runSaveProfile()) ?? latest;
      if (openingPolicy) latest = (await runSavePolicy()) ?? latest;
      if (doDelivery) latest = (await runSaveDelivery()) ?? latest;
      if (otherPolicy) latest = (await runSavePolicy()) ?? latest;
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
    if (canSavePolicy && policyDraft === "closed" && savedPolicy !== "closed") {
      setConfirmClosedPolicy(true);
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

  const dangerBusy = deleting || rotating || giftBusy || saving || !!busy;

  const openGift = () => {
    setGiftOpen(true);
    setGiftError(null);
    setGiftCopied(false);
    if (giftUrl || giftBusy) return;
    setGiftBusy(true);
    void client
      .createMyAgentTransferInvite(detail.agent_id)
      .then((res) => {
        const configured = interfazeBaseUrl.replace(/\/+$/, "");
        // Prefer host-configured public origin; fall back to current origin for local.
        const origin =
          configured ||
          (typeof window !== "undefined"
            ? window.location.origin.replace(/\/+$/, "")
            : "https://interfaze.io");
        const path = res.share_url.startsWith("/")
          ? res.share_url
          : `/${res.share_url}`;
        setGiftUrl(`${origin}${path}`);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChatGatewayError && err.message.trim()
            ? err.message
            : t.myAgentsGiftFailed;
        setGiftError(msg);
      })
      .finally(() => setGiftBusy(false));
  };

  const closeGift = () => {
    if (giftBusy) return;
    setGiftOpen(false);
  };

  const cancelGift = () => {
    setGiftBusy(true);
    setGiftError(null);
    void client
      .cancelMyAgentTransferInvite(detail.agent_id)
      .catch(() => {
        /* best-effort revoke; close regardless */
      })
      .finally(() => {
        setGiftUrl(null);
        setGiftBusy(false);
        setGiftOpen(false);
        setGiftCopied(false);
      });
  };

  const copyGiftLink = () => {
    if (!giftUrl) return;
    void copyText(giftUrl).then((ok) => {
      if (!ok) return;
      setGiftCopied(true);
      window.setTimeout(() => setGiftCopied(false), 2000);
    });
  };

  const deleteConfirmOk = (() => {
    const typed = deleteTyped.trim();
    if (!typed) return false;
    const name = (detail.name || "").trim();
    if (name && typed === name) return true;
    // Accept English DELETE keyword (locale-independent) to avoid accidental matches.
    return typed.toUpperCase() === "DELETE";
  })();

  const openDeleteConfirm = () => {
    setDangerError(null);
    setDeleteTyped("");
    setConfirmDelete(true);
  };

  const closeDeleteConfirm = () => {
    if (deleting) return;
    setConfirmDelete(false);
    setDeleteTyped("");
  };

  const runDelete = () => {
    if (dangerBusy || !deleteConfirmOk) return;
    setDeleting(true);
    setDangerError(null);
    client
      .deleteMyAgent(detail.agent_id)
      .then(() => {
        setConfirmDelete(false);
        setDeleteTyped("");
        onRemoved?.(detail.agent_id);
      })
      .catch((err: unknown) => {
        const code = err instanceof ChatGatewayError ? err.code : null;
        setDangerError(
          code === "agent_has_owned_subnets"
            ? t.myAgentsDeleteHasSubnets
            : t.myAgentsDeleteFailed,
        );
        setConfirmDelete(false);
        setDeleteTyped("");
      })
      .finally(() => setDeleting(false));
  };

  const optionBtn = (active: boolean): CSSProperties => ({
    ...btnGhost,
    width: "100%",
    textAlign: "left",
    padding: "8px 12px",
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
          {nameChanged && !nameOk ? (
            <div style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>
              {t.myAgentsNameHint}
            </div>
          ) : null}
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
          {clearingDesc ? (
            <div style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>
              {t.myAgentsDescClearHint}
            </div>
          ) : descChanged && !descOk ? (
            <div style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>
              {t.myAgentsDescHint}
            </div>
          ) : null}
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div
            style={{
              fontSize: 12,
              color: colors.muted,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {t.myAgentsTagsLabel}
            <FieldHint text={t.myAgentsTagsHint} />
            {tagsParsed.length > 0 ? (
              <span style={{ marginLeft: "auto" }}>{tagsParsed.length}/20</span>
            ) : null}
          </div>
          <input
            value={tagsDraft}
            onChange={(e) => setTagsDraft(e.target.value)}
            style={inputStyle}
            maxLength={400}
            disabled={busy || saving}
            placeholder="coding, research"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {profileError ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.danger }}>{profileError}</p>
        ) : null}
        {profileMsg ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.recommended }}>{profileMsg}</p>
        ) : null}
      </section>

      <section>
        <h3
          style={{
            ...sectionTitle,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {t.myAgentsSectionPricing}
            <FieldHint
              text={`${t.myAgentsPricingHint} ${t.myAgentsPricingSelfReportNote} ${t.myAgentsPricingModelHint}`}
            />
          </span>
          {(detail.inference_path || "byo") !== "official" ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 6px",
                borderRadius: 4,
                border: `1px solid ${colors.border}`,
                fontSize: 10,
                fontWeight: 650,
                letterSpacing: "0.04em",
                textTransform: "none",
                color: colors.muted,
              }}
            >
              {t.myAgentsInferencePathByo}
              <FieldHint text={t.myAgentsInferencePathByoHint} />
            </span>
          ) : null}
        </h3>
        {detail.token_pricing == null ? (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            {t.myAgentsPricingUnlisted}
          </p>
        ) : null}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>
            {t.myAgentsPricingModelLabel}
          </div>
          {modelsLoading ? (
            <p style={{ margin: "0 0 6px", fontSize: 12, color: colors.muted }}>…</p>
          ) : supportedModels.length === 0 ? (
            <p style={{ margin: "0 0 6px", fontSize: 12, color: colors.muted }}>
              {t.myAgentsPricingModelsEmpty}
            </p>
          ) : (
            <select
              aria-label={t.myAgentsPricingModelLabel}
              value={
                supportedModels.find((id) => sameModelId(id, modelIdDraft)) ??
                supportedModels[0]
              }
              onChange={(e) => setModelIdDraft(e.target.value)}
              disabled={busy || savingPricing}
              style={inputStyle}
            >
              {supportedModels.map((id) => (
                <option key={id} value={id}>
                  {catalogOptionLabel(id, catalogById[id])}
                </option>
              ))}
            </select>
          )}
          {runtimeMismatch ? (
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
              {fillTemplate(t.myAgentsPricingRuntimeHint, { model: runtimeId })}
            </div>
          ) : null}
        </div>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>
            {t.myAgentsPricingMarkupLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={markupDraft}
              onChange={(e) => setMarkupDraft(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              inputMode="decimal"
              disabled={busy || savingPricing}
              autoComplete="off"
            />
            <span style={{ fontSize: 13, color: colors.muted }}>%</span>
          </div>
        </label>
        {!previewReady && !catalogError ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.muted }}>…</p>
        ) : null}
        {catalogError ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.danger }}>{catalogError}</p>
        ) : null}
        {previewReady &&
        inputParsed != null &&
        outputParsed != null &&
        catalogIn != null &&
        catalogOut != null ? (
          <div style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.45 }}>
            <div style={{ color: colors.text }}>
              {fillTemplate(t.myAgentsPricingListingLine, {
                in: fmtUsd(inputParsed),
                out: fmtUsd(outputParsed),
              })}
            </div>
            <div style={{ color: colors.muted, marginTop: 2 }}>
              {fillTemplate(t.myAgentsPricingCatalogLine, {
                in: fmtUsd(catalogIn),
                out: fmtUsd(catalogOut),
              })}
            </div>
            <div
              style={{
                color: colors.muted,
                marginTop: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              {fillTemplate(t.myAgentsPricingCreditsLine, {
                in: String(usdToCredits(inputParsed)),
                out: String(usdToCredits(outputParsed)),
              })}
              <FieldHint text={t.myAgentsPricingCreditsNote} />
            </div>
          </div>
        ) : null}
        {pricingError ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.danger }}>{pricingError}</p>
        ) : null}
        {pricingMsg ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.recommended }}>{pricingMsg}</p>
        ) : null}
        <button
          type="button"
          style={{
            ...btnGhost,
            opacity: canSavePricing ? 1 : 0.45,
            cursor: canSavePricing ? "pointer" : "default",
          }}
          disabled={!canSavePricing}
          onClick={() => void runSavePricing()}
        >
          {savingPricing ? "…" : t.myAgentsSavePricing}
        </button>
      </section>

      {showConnectSection ? (
        <section>
          <h3 style={sectionTitle}>{t.myAgentsSectionConnect}</h3>
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
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                style={{ ...optionBtn(deliveryDraft === "relay"), flex: 1 }}
                disabled={!deliveryEditable || saving || busy}
                onClick={() => setDeliveryDraft("relay")}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsDeliveryOptionPull}</div>
              </button>
              <FieldHint text={t.myAgentsDeliveryPullHelp} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                style={{ ...optionBtn(deliveryDraft === "direct"), flex: 1 }}
                disabled={!deliveryEditable || saving || busy}
                onClick={() => setDeliveryDraft("direct")}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsDeliveryOptionPush}</div>
              </button>
              <FieldHint text={t.myAgentsDeliveryPushHelp} />
            </div>
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
        <h3 style={{ ...sectionTitle, display: "flex", alignItems: "center" }}>
          {t.myAgentsSectionAccess}
          <FieldHint text={t.myAgentsPolicyHint} />
        </h3>
        {currentPolicy === "manifest" ? (
          <p style={{ margin: "0 0 10px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
            {t.myAgentsPolicyManifestNote}
          </p>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              style={{ ...optionBtn(selectedPolicy === "open"), flex: 1 }}
              disabled={saving || busy}
              onClick={() => setPolicyDraft("open")}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsPolicyOpen}</div>
            </button>
            <FieldHint text={t.myAgentsPolicyOpenHelp} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              style={{ ...optionBtn(selectedPolicy === "allowlist"), flex: 1 }}
              disabled={saving || busy}
              onClick={() => setPolicyDraft("allowlist")}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsPolicyAllowlist}</div>
            </button>
            <FieldHint text={t.myAgentsPolicyAllowlistHelp} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              style={{ ...optionBtn(selectedPolicy === "closed"), flex: 1 }}
              disabled={saving || busy}
              onClick={() => setPolicyDraft("closed")}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.myAgentsPolicyClosed}</div>
            </button>
            <FieldHint text={t.myAgentsPolicyClosedHelp} />
          </div>
        </div>

        {showAllowlistEditor ? (
          <div
            style={{
              marginTop: 12,
              padding: "12px 12px",
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.bg,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 650, color: colors.text }}>
                {t.myAgentsAllowlistTitle}
              </span>
              <span style={{ fontSize: 11, color: colors.muted }}>
                {t.myAgentsAllowlistCount(String(allowlistTotal))}
              </span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
              {t.myAgentsAllowlistHint}
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={allowlistDraft}
                onChange={(e) => setAllowlistDraft(e.target.value)}
                placeholder={t.myAgentsAllowlistPlaceholder}
                disabled={busy || allowlistActing}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addAllowlistMember();
                  }
                }}
              />
              <button
                type="button"
                style={{ ...btnPrimary, fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                disabled={busy || allowlistActing || !allowlistDraft.trim()}
                onClick={() => void addAllowlistMember()}
              >
                {allowlistActing && !removingId ? t.loading : t.myAgentsAllowlistAdd}
              </button>
            </div>
            {allowlistDraft.trim().length >= 2 ? (
              <div
                style={{
                  marginBottom: 10,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  maxHeight: 140,
                  overflow: "auto",
                }}
              >
                {allowlistSearching ? (
                  <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: colors.muted }}>
                    {t.loading}
                  </p>
                ) : allowlistHits.length === 0 ? (
                  <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: colors.muted }}>
                    {t.myAgentsAllowlistSearchEmpty}
                  </p>
                ) : (
                  allowlistHits.map((hit) => (
                    <button
                      key={hit.agent_id}
                      type="button"
                      disabled={busy || allowlistActing}
                      onClick={() => void addAllowlistMember(hit.agent_id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        border: "none",
                        borderBottom: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.text,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {hit.name?.trim() || hit.agent_id}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.muted,
                          marginTop: 2,
                          wordBreak: "break-all",
                        }}
                      >
                        {hit.agent_id}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
            {allowlistError ? (
              <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.danger }}>
                {allowlistError}
              </p>
            ) : null}
            {allowlistLoading ? (
              <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{t.loading}</p>
            ) : allowlist.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
                {t.myAgentsAllowlistEmpty}
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 180,
                  overflow: "auto",
                }}
              >
                {allowlist.map((entry) => (
                  <li
                    key={entry.target_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.text,
                          wordBreak: "break-all",
                        }}
                      >
                        {entry.target_id}
                      </div>
                      {entry.reason ? (
                        <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                          {entry.reason}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      style={{ ...btnGhost, fontSize: 11, padding: "4px 8px", flexShrink: 0 }}
                      disabled={busy || allowlistActing}
                      onClick={() => void removeAllowlistMember(entry.target_id)}
                    >
                      {removingId === entry.target_id ? t.loading : t.myAgentsAllowlistRemove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {policyError ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.danger }}>{policyError}</p>
        ) : null}
        {policyMsg ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.recommended }}>{policyMsg}</p>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <DetailRows
            rows={[
              {
                label: t.myAgentsChatOpen,
                hint: t.myAgentsChatOpenHint,
                value: boolLabel(detail.chat_open, t),
              },
            ]}
          />
        </div>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rotateError || dangerError ? (
          <p style={{ margin: 0, fontSize: 12, color: colors.danger }}>
            {rotateError || dangerError}
          </p>
        ) : null}
        {profileError || deliveryError || policyError ? (
          <p style={{ margin: 0, fontSize: 12, color: colors.danger }}>
            {profileError || deliveryError || policyError}
          </p>
        ) : null}
        {profileMsg || deliveryMsg || policyMsg ? (
          <p style={{ margin: 0, fontSize: 12, color: colors.recommended }}>
            {profileMsg || deliveryMsg || policyMsg}
          </p>
        ) : null}
        {hasEdits || saving ? (
          <button
            type="button"
            style={{ ...btnPrimary, width: "100%" }}
            disabled={!canSaveAny}
            onClick={saveAll}
          >
            {saving ? t.loading : t.save}
          </button>
        ) : null}
        <button
          type="button"
          style={{
            ...btnGhost,
            width: "100%",
            borderColor: "rgba(248,113,113,0.45)",
            color: colors.danger,
          }}
          disabled={dangerBusy}
          onClick={() => {
            setRotateError(null);
            setDangerError(null);
            setConfirmRotate(true);
          }}
        >
          {t.myAgentsRotateKey}
        </button>
        <button
          type="button"
          style={{
            ...btnGhost,
            width: "100%",
            background: "rgba(248,113,113,0.1)",
            borderColor: "rgba(248,113,113,0.55)",
            color: colors.danger,
            fontWeight: 600,
          }}
          disabled={dangerBusy}
          onClick={openDeleteConfirm}
        >
          {t.myAgentsDelete}
        </button>
        {/* Gift / transfer ownership — last, away from delete */}
        <button
          type="button"
          style={{ ...btnGhost, width: "100%" }}
          disabled={dangerBusy}
          onClick={openGift}
        >
          {t.myAgentsGift}
        </button>
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

      {confirmClosedPolicy ? (
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
            if (!savingPolicy) setConfirmClosedPolicy(false);
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
              {t.myAgentsPolicyClosedConfirm}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={btnGhost}
                disabled={savingPolicy}
                onClick={() => setConfirmClosedPolicy(false)}
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
                disabled={saving}
                onClick={runSaveAll}
              >
                {saving ? t.loading : t.myAgentsPolicyClosedConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {giftOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.myAgentsGiftTitle}
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
          onClick={closeGift}
        >
          <div
            style={{
              width: "min(360px, 100%)",
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {t.myAgentsGiftTitle}
              </h3>
              <button
                type="button"
                style={{ ...btnGhost, padding: "4px 10px" }}
                disabled={giftBusy}
                onClick={closeGift}
              >
                ×
              </button>
            </div>
            {giftBusy && !giftUrl ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: colors.muted }}>
                {t.myAgentsGiftGenerating}
              </p>
            ) : giftError ? (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: colors.danger }}>
                {giftError}
              </p>
            ) : giftUrl ? (
              <>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: colors.muted,
                  }}
                >
                  {t.myAgentsGiftHint}
                </p>
                <div
                  style={{
                    ...inputStyle,
                    marginBottom: 12,
                    wordBreak: "break-all",
                    fontSize: 12,
                    lineHeight: 1.45,
                    userSelect: "all",
                  }}
                >
                  {giftUrl}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    style={btnGhost}
                    disabled={giftBusy}
                    onClick={cancelGift}
                  >
                    {t.myAgentsGiftCancel}
                  </button>
                  <button
                    type="button"
                    style={btnPrimary}
                    disabled={giftBusy}
                    onClick={copyGiftLink}
                  >
                    {giftCopied ? t.myAgentsGiftCopied : t.myAgentsGiftCopy}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" style={btnGhost} onClick={closeGift}>
                  {t.myAgentsGiftClose}
                </button>
              </div>
            )}
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

      {confirmDelete ? (
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
          onClick={closeDeleteConfirm}
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
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
              {t.myAgentsDeleteConfirm}
            </p>
            <label style={{ display: "block", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>
                {t.myAgentsDeleteTypeHint}
              </div>
              <input
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder={t.myAgentsDeleteTypePlaceholder}
                autoFocus
                disabled={deleting}
                style={inputStyle}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={btnGhost}
                disabled={deleting}
                onClick={closeDeleteConfirm}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                style={{
                  ...btnGhost,
                  background: "rgba(248,113,113,0.2)",
                  borderColor: "rgba(248,113,113,0.55)",
                  color: colors.danger,
                  fontWeight: 600,
                }}
                disabled={deleting || !deleteConfirmOk}
                onClick={runDelete}
              >
                {deleting ? t.loading : t.myAgentsDeleteConfirmLabel}
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
