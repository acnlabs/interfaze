"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  AccountKey,
  ChatCollabBudget,
  GatewayClient,
  HumanWallet,
  MyAgentSummary,
  MyAgentWalletTx,
  PlanCatalogEntry,
  PlanUsage,
} from "../gateway";
import type { RanchChatAccount } from "../types";
import { AgentOwnerWallet } from "./AgentOwnerWallet";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnIcon, btnPrimary, colors } from "./styles";
import {
  buildWalletCheckoutUrl,
  isInterfazeHostname,
  prefersInPanelCheckout,
  resolveInterfazeOrigin,
} from "./interfazeHost";
import { cleanTxDescription, fmtTxTimeShort, txTypeLabel } from "./txDisplay";

/** Shared card container for all account panel sections. */
const card: CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  padding: 16,
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  marginRight: 0,
  marginBottom: 10,
  marginLeft: 0,
  fontSize: 13,
  fontWeight: 650,
  letterSpacing: "0.01em",
  color: colors.text,
};

const sectionHint: CSSProperties = {
  marginTop: 0,
  marginRight: 0,
  marginBottom: 14,
  marginLeft: 0,
  fontSize: 12,
  color: colors.muted,
  lineHeight: 1.55,
};

/** Panel actions are one size up from the compact shell chrome buttons. */
const btnPrimaryLg: CSSProperties = {
  ...btnPrimary,
  padding: "9px 16px",
  fontSize: 13,
  borderRadius: 10,
};

const btnGhostLg: CSSProperties = {
  ...btnGhost,
  padding: "9px 16px",
  fontSize: 13,
  borderRadius: 10,
};

function useHover(): [boolean, { onMouseEnter: () => void; onMouseLeave: () => void }] {
  const [hover, setHover] = useState(false);
  return [hover, { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) }];
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "ok";
  children: ReactNode;
}) {
  const palette: CSSProperties =
    tone === "accent"
      ? { background: colors.accentSoft, color: "#7aa2f7" }
      : tone === "ok"
        ? { background: "rgba(16,185,129,0.14)", color: "#34d399" }
        : { background: "rgba(255,255,255,0.07)", color: colors.muted };
  return (
    <span
      style={{
        ...palette,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function AvatarDot({ label, size = 34 }: { label: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        background: colors.accentSoft,
        color: "#7aa2f7",
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

/** List row with hover feedback and optional chevron; used inside padded cards. */
function RowButton({
  onClick,
  disabled = false,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [hover, hoverProps] = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...hoverProps}
      style={{
        width: "100%",
        border: 0,
        background: hover && !disabled ? colors.hover : "transparent",
        color: disabled ? colors.muted : colors.text,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "background 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13, color: colors.muted, lineHeight: 1.55 }}>{children}</p>;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 12px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${colors.border}`,
        minWidth: 88,
      }}
    >
      <span style={{ fontSize: 11, color: colors.muted }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </span>
  );
}

function PanelChrome({
  title,
  onClose,
  closeLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
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
          gap: 10,
          padding: "12px 16px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
          background: "rgba(15,20,25,0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        <button type="button" style={btnIcon} onClick={onClose} aria-label={closeLabel}>
          ←
        </button>
        <strong style={{ fontSize: 16, fontWeight: 650, flex: 1, letterSpacing: "-0.01em" }}>
          {title}
        </strong>
        <span style={{ width: 28 }} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 20px 32px" }}>
        <div style={{ maxWidth: 680, width: "100%", margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}

/** Covers the whole chat viewport — not the 360px account sidebar. */
function ViewportOverlay({
  label,
  zIndex,
  onBackdrop,
  children,
}: {
  label: string;
  zIndex: number;
  onBackdrop?: () => void;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "rgba(0,0,0,0.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onBackdrop}
    >
      {children}
    </div>,
    document.body,
  );
}

export function AccountProfilePanel({
  account,
  messages: t,
  onClose,
}: {
  account: RanchChatAccount;
  messages: RanchMessages;
  onClose: () => void;
}) {
  const name = (account.name || "").trim();
  const email = (account.email || "").trim();
  const initial = (name || email || t.account).slice(0, 1).toUpperCase() || "?";

  return (
    <PanelChrome title={t.accountProfile} onClose={onClose} closeLabel={t.close}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: 20 }}>
        {account.picture ? (
          <img
            src={account.picture}
            alt=""
            width={64}
            height={64}
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              objectFit: "cover",
              background: colors.border,
              flexShrink: 0,
            }}
          />
        ) : (
          <AvatarDot label={initial} size={64} />
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 650, letterSpacing: "-0.01em" }}>
            {name || t.account}
          </p>
          {email ? (
            <p style={{ margin: "5px 0 0", fontSize: 13, color: colors.muted }}>{email}</p>
          ) : null}
        </div>
      </div>
      <p style={{ ...sectionHint, marginTop: 16, marginBottom: 0 }}>{t.accountProfileHint}</p>
    </PanelChrome>
  );
}

const planCard: CSSProperties = {
  ...card,
  padding: "18px 18px 16px",
};

const planSectionLabel: CSSProperties = {
  ...sectionTitle,
};

function UsageBar({
  ratio,
  tone = "accent",
}: {
  ratio: number;
  tone?: "accent" | "neutral";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginTop: 10,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background:
            tone === "accent"
              ? "linear-gradient(90deg, #3b82f6, #7aa2f7)"
              : "rgba(232,238,245,0.55)",
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}

function fmtTpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

function periodMeta(
  endIso: string | undefined,
  locale: "en" | "zh",
): { dateLabel: string; daysLeft: number } {
  if (!endIso) return { dateLabel: "—", daysLeft: 0 };
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return { dateLabel: endIso, daysLeft: 0 };
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000));
  const dateLabel = end.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
  return { dateLabel, daysLeft };
}

function isTrustedCheckoutOrigin(origin: string, subscribeBase: string): boolean {
  const trusted = new Set<string>(["https://interfaze.io", "https://interfaze.acnlabs.cn"]);
  try {
    trusted.add(new URL(subscribeBase).origin);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && isInterfazeHostname(window.location.hostname)) {
    trusted.add(window.location.origin);
  }
  return trusted.has(origin);
}

/** postMessage from /subscribe?embed=1 when plan activates. */
export const PLAN_ACTIVATED_MSG = "interfaze:plan-activated";
/** postMessage from /wallet?embed=1 when Credits land. */
export const WALLET_CREDITED_MSG = "interfaze:wallet-credited";

export function AccountPlanUsagePanel({
  client,
  messages: t,
  locale = "en",
  agentPlanetBaseUrl: _agentPlanetBaseUrl = "https://agentplanet.org",
  interfazeBaseUrl = "https://interfaze.io",
  onClose,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  locale?: "en" | "zh";
  agentPlanetBaseUrl?: string;
  /** Interfaze origin for /subscribe checkout (shell embed + deep link). */
  interfazeBaseUrl?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlanUsage | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [limitMode, setLimitMode] = useState<"unlimited" | "fixed">("unlimited");
  const [limitInput, setLimitInput] = useState("200");
  const [limitBusy, setLimitBusy] = useState(false);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [buyBusy, setBuyBusy] = useState<string | null>(null);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [buyMsgTone, setBuyMsgTone] = useState<"muted" | "ok" | "danger">("muted");
  /** In-shell Interfaze /subscribe embed (QR / PayPal). */
  const [checkoutEmbedUrl, setCheckoutEmbedUrl] = useState<string | null>(null);
  type CheckoutWatch = {
    code: string;
    priorCode: string;
    paidUntil: string | null;
    wasRenew: boolean;
    watchUntil: number;
  };
  /** Open checkouts may overlap; keep a short watch list (not a single overwrite). */
  const checkoutWatchesRef = useRef<CheckoutWatch[]>([]);
  const subscribeBase = resolveInterfazeOrigin(interfazeBaseUrl);
  const rechargeUrl = buildWalletCheckoutUrl({
    interfazeBaseUrl,
    returnTo: "/?account=wallet",
  });


  function buildSubscribeUrl(code: string, renew: boolean, embed: boolean): string {
    const u = new URL(`${subscribeBase}/subscribe`);
    u.searchParams.set("plan", code);
    if (renew) u.searchParams.set("renew", "1");
    if (embed) {
      u.searchParams.set("embed", "1");
      if (typeof window !== "undefined") {
        u.searchParams.set("parent_origin", window.location.origin);
      }
    } else if (typeof window !== "undefined") {
      // After PayPal full-page return, land back on chat + reopen Plan.
      u.searchParams.set("return_to", "/?account=plan");
    }
    return u.toString();
  }

  function allowedCheckoutOrigin(url: string | null): string | null {
    if (!url) return null;
    try {
      const origin = new URL(url).origin;
      if (!isTrustedCheckoutOrigin(origin, subscribeBase)) return null;
      return origin;
    } catch {
      return null;
    }
  }

  function resolveTrustedCheckoutUrl(candidate: string): string | null {
    try {
      const u = new URL(candidate);
      if (!isTrustedCheckoutOrigin(u.origin, subscribeBase)) return null;
      // Checkout UI is /subscribe (or nested under it) — reject arbitrary paths.
      if (u.pathname !== "/subscribe" && !u.pathname.startsWith("/subscribe/")) {
        return null;
      }
      return u.toString();
    } catch {
      return null;
    }
  }

  const applyPlanUsage = useCallback((row: PlanUsage) => {
    setData(row);
    const mode = row.on_demand?.mode === "fixed" ? "fixed" : "unlimited";
    setLimitMode(mode);
    setLimitInput(String(row.on_demand?.limit_credits ?? 200));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void client
      .getPlanUsage()
      .then((row) => {
        if (cancelled) return;
        applyPlanUsage(row);
      })
      .catch(() => {
        if (!cancelled) setError(t.accountPlanUsageLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, t.accountPlanUsageLoadFailed, applyPlanUsage]);

  const refreshAfterCheckout = useCallback(async () => {
    const now = Date.now();
    checkoutWatchesRef.current = checkoutWatchesRef.current.filter((w) => now <= w.watchUntil);
    if (checkoutWatchesRef.current.length === 0) return;
    try {
      const row = await client.getPlanUsage();
      applyPlanUsage(row);
      const nextCode = (row.plan?.code || "free").toLowerCase();
      const nextUntil = row.plan?.paid_until ?? null;
      let matched: CheckoutWatch | null = null;
      for (const baseline of checkoutWatchesRef.current) {
        const onTarget = nextCode === baseline.code;
        // Do not use pack-used drops: monthly pack counters can reset without payment.
        const untilMoved = nextUntil != null && nextUntil !== baseline.paidUntil;
        const tierMoved = onTarget && baseline.priorCode !== nextCode;
        const firstPaid = onTarget && baseline.paidUntil == null && nextUntil != null;
        if (onTarget && (untilMoved || tierMoved || firstPaid)) {
          matched = baseline;
          break;
        }
      }
      if (!matched) return;
      const date =
        periodMeta(nextUntil ?? undefined, locale).dateLabel || nextUntil || "—";
      const planName =
        locale === "zh" ? row.plan.label_zh || row.plan.label : row.plan.label;
      setBuyMsgTone("ok");
      setBuyMsg(
        fmtTpl(
          matched.wasRenew ? t.accountPlanBuySuccessRenew : t.accountPlanBuySuccess,
          { plan: planName || matched.code, date },
        ),
      );
      // Drop watches for the activated tier (and expired ones).
      checkoutWatchesRef.current = checkoutWatchesRef.current.filter(
        (w) => w.code !== matched!.code && Date.now() <= w.watchUntil,
      );
    } catch {
      /* keep watching until watchUntil */
    }
  }, [applyPlanUsage, client, locale, t.accountPlanBuySuccess, t.accountPlanBuySuccessRenew]);

  useEffect(() => {
    const onReturn = () => {
      if (checkoutWatchesRef.current.length === 0) return;
      if (document.visibilityState && document.visibilityState !== "visible") return;
      void refreshAfterCheckout();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refreshAfterCheckout]);

  const planLabel =
    locale === "zh"
      ? data?.plan.label_zh || data?.plan.label || "—"
      : data?.plan.label || "—";
  const used = data?.usage.dialog_credits ?? 0;
  const byAgent = data?.usage.by_agent ?? [];
  const { dateLabel, daysLeft } = periodMeta(data?.period.end, locale);
  const paidUntilMeta = periodMeta(data?.plan.paid_until ?? undefined, locale);
  const odSpent = data?.on_demand?.spent_credits ?? used;
  const odLimit =
    data?.on_demand?.mode === "fixed" ? (data.on_demand.limit_credits ?? 0) : null;
  const onDemandRatio =
    odLimit != null && odLimit > 0
      ? Math.min(1, odSpent / odLimit)
      : odSpent <= 0
        ? 0
        : Math.min(1, odSpent / 200);

  async function saveOnDemandLimit() {
    setLimitBusy(true);
    setLimitMsg(null);
    try {
      const lim = Math.max(0, Math.trunc(Number(limitInput) || 0));
      const row = await client.putOnDemandLimit(
        limitMode,
        limitMode === "fixed" ? lim : undefined,
      );
      setData(row);
      setLimitMode(row.on_demand?.mode === "fixed" ? "fixed" : "unlimited");
      setLimitInput(String(row.on_demand?.limit_credits ?? (lim || 200)));
      setLimitMsg(t.accountPlanLimitSaved);
    } catch {
      setLimitMsg(t.accountPlanLimitSaveFailed);
    } finally {
      setLimitBusy(false);
    }
  }

  function requestBuyPlan(tier: PlanCatalogEntry, opts?: { renew?: boolean }) {
    if (buyBusy) return;
    const code = tier.code.toLowerCase() === "ultra" ? "max" : tier.code.toLowerCase();
    const wasRenew = Boolean(opts?.renew);
    setBuyMsg(null);
    setBuyMsgTone("muted");
    const useWeChat =
      prefersInPanelCheckout(subscribeBase) ||
      (tier.fiat_currency || "").toUpperCase() === "CNY";
    if (!useWeChat) {
      if (typeof window !== "undefined") {
        window.location.assign(buildSubscribeUrl(code, wasRenew, false));
      }
      return;
    }
    void openWeChatCheckout(code, wasRenew);
  }

  async function openWeChatCheckout(code: string, wasRenew: boolean) {
    setBuyBusy(code);
    setBuyMsg(null);
    setBuyMsgTone("muted");
    const watch: CheckoutWatch = {
      code,
      priorCode: (data?.plan.code || "free").toLowerCase(),
      paidUntil: data?.plan.paid_until ?? null,
      wasRenew,
      watchUntil: Date.now() + 15 * 60 * 1000,
    };
    const now = Date.now();
    checkoutWatchesRef.current = [
      ...checkoutWatchesRef.current.filter((w) => now <= w.watchUntil),
      watch,
    ].slice(-4);
    try {
      let checkoutUrl = buildSubscribeUrl(code, wasRenew, false);
      try {
        const row = await client.getPlanCheckout(code);
        if (row.checkout_url) {
          const trusted = resolveTrustedCheckoutUrl(row.checkout_url);
          if (trusted) {
            const u = new URL(trusted);
            if (wasRenew) u.searchParams.set("renew", "1");
            u.searchParams.delete("embed");
            if (!u.searchParams.get("return_to")) {
              u.searchParams.set("return_to", "/?account=plan");
            }
            checkoutUrl = u.toString();
          }
        }
      } catch {
        // Fall back to Interfaze /subscribe constructed above.
      }
      setBuyMsgTone("muted");
      setBuyMsg(t.accountPlanCheckoutPending);

      if (prefersInPanelCheckout(checkoutUrl)) {
        const u = new URL(checkoutUrl);
        u.searchParams.set("embed", "1");
        if (typeof window !== "undefined") {
          u.searchParams.set("parent_origin", window.location.origin);
        }
        setCheckoutEmbedUrl(u.toString());
      } else if (typeof window !== "undefined") {
        try {
          const dest = new URL(checkoutUrl, window.location.origin);
          if (dest.origin === window.location.origin) {
            window.location.assign(dest.toString());
          } else {
            window.open(dest.toString(), "_blank", "noopener,noreferrer");
          }
        } catch {
          window.location.href = checkoutUrl;
        }
      }
      void refreshAfterCheckout();
    } catch {
      setBuyMsgTone("danger");
      setBuyMsg(t.accountPlanBuyFailed);
    } finally {
      setBuyBusy(null);
    }
  }


  useEffect(() => {
    if (!checkoutEmbedUrl) return;
    const expectedOrigin = allowedCheckoutOrigin(checkoutEmbedUrl);
    // Refuse to listen when embed URL origin is untrusted / unparseable.
    if (!expectedOrigin) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== expectedOrigin) return;
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== PLAN_ACTIVATED_MSG) return;
      setCheckoutEmbedUrl(null);
      setBuyMsgTone("ok");
      void refreshAfterCheckout();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [checkoutEmbedUrl, refreshAfterCheckout]);

  useEffect(() => {
    const onPaid = () => {
      void client
        .getPlanUsage()
        .then(applyPlanUsage)
        .catch(() => {
          /* ignore */
        });
    };
    window.addEventListener(PLAN_ACTIVATED_MSG, onPaid);
    return () => window.removeEventListener(PLAN_ACTIVATED_MSG, onPaid);
  }, [client, applyPlanUsage]);

  const catalog: PlanCatalogEntry[] =
    data?.catalog && data.catalog.length > 0
      ? data.catalog
      : [
          {
            code: "free",
            label: "Free",
            label_zh: "免费",
            price_credits: null,
            purchasable: false,
            dialog_allowance_credits: null,
          },
        ];
  const currentCode = (data?.plan.code || "free").toLowerCase();

  return (
    <PanelChrome title={t.accountPlanUsage} onClose={onClose} closeLabel={t.close}>
      {loading ? (
        <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
      ) : error ? (
        <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <section>
            <h3 style={sectionTitle}>{t.accountPlanCurrent}</h3>
            <div
              style={{
                ...planCard,
                padding: 20,
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(16,185,129,0.05) 100%), #151b23",
                border: "1px solid rgba(59,130,246,0.22)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {planLabel}
                </span>
                <Badge tone="accent">{t.accountPlanCurrent}</Badge>
                <span style={{ fontSize: 13, color: colors.muted }}>
                  {currentCode === "free" ? t.accountPlanPayg : t.accountPlanIncludedUsage}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
                {currentCode !== "free" && data?.plan.paid_until
                  ? `${fmtTpl(t.accountPlanExpiresOn, { date: paidUntilMeta.dateLabel })}${
                      paidUntilMeta.daysLeft > 0
                        ? ` (${fmtTpl(t.accountPlanDaysLeft, { n: paidUntilMeta.daysLeft })})`
                        : ""
                    }`
                  : `${fmtTpl(t.accountPlanResetOn, { date: dateLabel })}${
                      daysLeft > 0 ? ` (${fmtTpl(t.accountPlanDaysLeft, { n: daysLeft })})` : ""
                    }`}
              </p>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  style={btnGhostLg}
                  onClick={() => {
                    const now = Date.now();
                    checkoutWatchesRef.current = checkoutWatchesRef.current.filter(
                      (w) => now <= w.watchUntil,
                    );
                    if (checkoutWatchesRef.current.length > 0) {
                      setBuyMsgTone("muted");
                      setBuyMsg(t.accountPlanCheckoutPending);
                      void refreshAfterCheckout();
                    }
                    setAdjustOpen(true);
                  }}
                >
                  {t.accountPlanAdjust}
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 style={planSectionLabel}>
              {fmtTpl(t.accountPlanIncludedIn, { plan: planLabel })}
            </h3>
            <div style={planCard}>
              {(() => {
                // Free / unhonored: no official pack yet — show empty included meter.
                const hasPack =
                  data?.allowance.honored === true &&
                  data.allowance.dialog_credits != null &&
                  data.allowance.dialog_credits > 0;
                const pack = hasPack ? (data.allowance.dialog_credits as number) : 0;
                const usedPack = hasPack
                  ? Math.min(pack, data.allowance.dialog_credits_used || 0)
                  : 0;
                const ratio = hasPack && pack > 0 ? usedPack / pack : 0;
                const right = hasPack
                  ? fmtTpl(t.accountPlanUsedPct, {
                      n: Math.round(ratio * 100),
                    })
                  : t.accountPlanNotIncluded;
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {t.accountPlanIncludedUsage}
                      </span>
                      <span style={{ fontSize: 12, color: colors.muted }}>{right}</span>
                    </div>
                    <UsageBar ratio={ratio} tone="accent" />
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 11,
                        color: colors.muted,
                        lineHeight: 1.45,
                      }}
                    >
                      {t.accountPlanIncludedUsageHint}
                    </p>
                  </div>
                );
              })()}
            </div>
          </section>

          <section>
            <h3 style={planSectionLabel}>{t.accountPlanOnDemand}</h3>
            <div style={{ ...planCard, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.accountPlanDialogUsage}</span>
                  <span
                    style={{
                      fontSize: 13,
                      color: colors.muted,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {odLimit != null
                      ? fmtTpl(t.accountPlanUsedOfLimit, {
                          used: fmtCredits(odSpent),
                          limit: fmtCredits(odLimit),
                        })
                      : `${fmtCredits(odSpent)} ${t.walletBalance}`}
                  </span>
                </div>
                <UsageBar ratio={onDemandRatio} tone="neutral" />
                <p style={{ margin: "8px 0 0", fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
                  {t.accountPlanOnDemandHint}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.accountPlanMonthlyLimit}</div>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
                    {t.accountPlanMonthlyLimitHint}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    value={limitMode}
                    onChange={(e) =>
                      setLimitMode(e.target.value === "fixed" ? "fixed" : "unlimited")
                    }
                    style={{
                      ...btnGhost,
                      padding: "6px 8px",
                      appearance: "auto",
                      background: "#121820",
                    }}
                  >
                    <option value="fixed">{t.accountPlanLimitFixed}</option>
                    <option value="unlimited">{t.accountPlanLimitUnlimited}</option>
                  </select>
                  {limitMode === "fixed" ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={limitInput}
                      onChange={(e) => setLimitInput(e.target.value)}
                      style={{
                        width: 72,
                        border: `1px solid ${colors.border}`,
                        background: "#121820",
                        color: colors.text,
                        borderRadius: 8,
                        padding: "6px 8px",
                        fontSize: 13,
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={limitBusy}
                    style={{ ...btnGhost, padding: "6px 10px", opacity: limitBusy ? 0.6 : 1 }}
                    onClick={() => void saveOnDemandLimit()}
                  >
                    {t.accountPlanLimitSave}
                  </button>
                </div>
              </div>
              {limitMsg ? (
                <p style={{ margin: 0, fontSize: 11, color: colors.muted }}>{limitMsg}</p>
              ) : null}

              {byAgent.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
                  {t.accountPlanEmptyUsage}
                </p>
              ) : (
                <div>
                  <p style={{ ...sectionTitle, marginBottom: 6 }}>{t.accountPlanByAgent}</p>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {byAgent.map((row) => {
                      const share = odSpent > 0 ? row.credits / odSpent : 0;
                      return (
                        <li key={row.agent_id} style={{ padding: "10px 0 0" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "baseline",
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 13,
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.agent_id}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: colors.muted,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {fmtTpl(t.accountPlanUsedPct, {
                                n: Math.round(share * 100),
                              })}
                              {" · "}
                              {fmtCredits(row.credits)}
                            </span>
                          </div>
                          <UsageBar ratio={share} tone="accent" />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {adjustOpen ? (
        <ViewportOverlay
          label={t.accountPlanAdjustTitle}
          zIndex={10050}
          onBackdrop={() => {
            if (buyBusy) return;
            setAdjustOpen(false);
          }}
        >
          <div
            style={{
              width: "min(920px, calc(100vw - 32px))",
              maxHeight: "min(90vh, 900px)",
              overflow: "auto",
              background: "#141a22",
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              padding: "20px 18px 16px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <strong style={{ fontSize: 16 }}>{t.accountPlanAdjustTitle}</strong>
              <button
                type="button"
                style={{ ...btnGhost, width: 28, height: 28, padding: 0 }}
                onClick={() => {
                  if (buyBusy) return;
                  setAdjustOpen(false);
                }}
                aria-label={t.close}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                alignItems: "stretch",
              }}
            >
              {catalog.map((tier) => {
                const isCurrent = tier.code.toLowerCase() === currentCode;
                const tierLabel =
                  locale === "zh" ? tier.label_zh || tier.label : tier.label;
                const isFree = tier.code.toLowerCase() === "free";
                const price = (() => {
                  if (tier.fiat_amount != null && tier.fiat_amount > 0) {
                    const n = String(tier.fiat_amount);
                    if ((tier.fiat_currency || "").toUpperCase() === "CNY") {
                      return fmtTpl(t.accountPlanPriceFiatCny, { n });
                    }
                    return fmtTpl(t.accountPlanPriceFiatUsd, { n });
                  }
                  if (tier.price_credits != null && tier.price_credits > 0) {
                    return fmtTpl(t.accountPlanPriceCredits, {
                      n: fmtCredits(tier.price_credits),
                    });
                  }
                  return t.accountPlanPayg;
                })();
                const blurb = isFree ? t.accountPlanFreeBlurb : t.accountPlanProBlurb;
                const bullets = isFree
                  ? [t.accountPlanIncludedUsage, t.accountPlanPayg]
                  : [
                      tier.dialog_allowance_credits != null
                        ? fmtTpl(t.accountPlanIncludedPack, {
                            n: fmtCredits(tier.dialog_allowance_credits),
                          })
                        : t.accountPlanIncludedUsage,
                      t.accountPlanPayg,
                    ];
                const busy = buyBusy === tier.code;
                return (
                  <div
                    key={tier.code}
                    style={{
                      ...planCard,
                      position: "relative",
                      background: isCurrent ? "#1a2330" : colors.panel,
                      border: isCurrent
                        ? "1px solid rgba(59,130,246,0.45)"
                        : `1px solid ${colors.border}`,
                    }}
                  >
                    {isCurrent ? (
                      <span style={{ position: "absolute", top: 12, right: 12 }}>
                        <Badge tone="accent">{t.accountPlanCurrent}</Badge>
                      </span>
                    ) : null}
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>{tierLabel}</p>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {price}
                    </p>
                    {isCurrent && !isFree && data?.plan.paid_until ? (
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 12,
                          color: colors.muted,
                          lineHeight: 1.4,
                        }}
                      >
                        {fmtTpl(t.accountPlanExpiresOn, {
                          date: paidUntilMeta.dateLabel,
                        })}
                      </p>
                    ) : null}
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 12,
                        color: colors.muted,
                        lineHeight: 1.5,
                      }}
                    >
                      {blurb}
                    </p>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: "14px 0 0",
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {bullets.map((line) => (
                        <li
                          key={line}
                          style={{
                            display: "flex",
                            gap: 8,
                            fontSize: 12,
                            color: colors.muted,
                            lineHeight: 1.4,
                          }}
                        >
                          <span aria-hidden style={{ color: colors.text }}>
                            ✓
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    {isCurrent && tier.purchasable ? (
                      <button
                        type="button"
                        disabled={busy || buyBusy != null}
                        style={{
                          ...btnPrimary,
                          width: "100%",
                          marginTop: 16,
                          padding: "9px 12px",
                          opacity: busy || buyBusy != null ? 0.7 : 1,
                        }}
                        onClick={() => requestBuyPlan(tier, { renew: true })}
                      >
                        {t.accountPlanRenew}
                      </button>
                    ) : isCurrent ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          ...btnGhost,
                          width: "100%",
                          marginTop: 16,
                          padding: "9px 12px",
                          background: "rgba(255,255,255,0.08)",
                          cursor: "default",
                          opacity: 0.9,
                        }}
                      >
                        {t.accountPlanYourCurrent}
                      </button>
                    ) : tier.purchasable ? (
                      <button
                        type="button"
                        disabled={busy || buyBusy != null}
                        style={{
                          ...btnPrimary,
                          width: "100%",
                          marginTop: 16,
                          padding: "9px 12px",
                          opacity: busy || buyBusy != null ? 0.7 : 1,
                        }}
                        onClick={() => requestBuyPlan(tier)}
                      >
                        {t.accountPlanUpgrade}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {buyMsg ? (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color:
                      buyMsgTone === "ok"
                        ? "#7dcea0"
                        : buyMsgTone === "danger"
                          ? colors.danger
                          : colors.muted,
                    lineHeight: 1.45,
                  }}
                >
                  {buyMsg}
                </p>
                {buyMsg === t.accountPlanNeedCredits ? (
                  <a
                    href={rechargeUrl}
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      fontSize: 12,
                      color: colors.accent,
                    }}
                  >
                    {t.accountPlanOpenWallet}
                  </a>
                ) : null}
              </div>
            ) : null}

          </div>
        </ViewportOverlay>
      ) : null}

      {checkoutEmbedUrl ? (
        <ViewportOverlay
          label={locale === "zh" ? "界面订阅" : "Interfaze Subscribe"}
          zIndex={10060}
          onBackdrop={() => setCheckoutEmbedUrl(null)}
        >
          <div
            style={{
              width: "min(420px, 100%)",
              height: "min(640px, 92%)",
              background: "#0a0a0a",
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <strong style={{ fontSize: 14 }}>
                {locale === "zh" ? "界面订阅" : "Interfaze Subscribe"}
              </strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={checkoutEmbedUrl.replace(/([?&])embed=1&?/, "$1").replace(/[?&]$/, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: colors.muted }}
                >
                  {locale === "zh" ? "新窗口打开" : "Open page"}
                </a>
                <button
                  type="button"
                  style={{ ...btnGhost, width: 28, height: 28, padding: 0 }}
                  onClick={() => setCheckoutEmbedUrl(null)}
                  aria-label={t.close}
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              title={locale === "zh" ? "界面订阅" : "Interfaze Subscribe"}
              src={checkoutEmbedUrl}
              allow="payment"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ flex: 1, width: "100%", border: 0, background: "#0a0a0a" }}
            />
          </div>
        </ViewportOverlay>
      ) : null}
    </PanelChrome>
  );
}

function fmtCredits(n: number): string {
  return Math.trunc(n).toLocaleString();
}

function fmtTxTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Account default collab tank + optional per-chat remaining controls. */
export function ChatCollabBudgetSection({
  client,
  messages: t,
  chatId,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  chatId?: string | null;
}) {
  const [cap, setCap] = useState(0);
  const [capDraft, setCapDraft] = useState("0");
  const [budget, setBudget] = useState<ChatCollabBudget | null>(null);
  const [addDraft, setAddDraft] = useState("20");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    setErr(null);
    void client
      .getCollabCap()
      .then((r) => {
        setCap(r.cap_credits);
        setCapDraft(String(r.cap_credits));
      })
      .catch(() => setErr(t.sendFailed));
    if (chatId) {
      void client
        .getChatCollabBudget(chatId)
        .then(setBudget)
        .catch(() => setBudget(null));
    } else {
      setBudget(null);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on chat/client
  }, [client, chatId]);

  return (
    <div>
      <h3 style={sectionTitle}>{t.collabBudget}</h3>
      <p style={sectionHint}>{t.collabBudgetHint}</p>
      {err ? (
        <p style={{ color: colors.danger, fontSize: 12, margin: "0 0 10px" }}>{err}</p>
      ) : null}
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        {t.collabAccountCap}
      </label>
      <div style={{ display: "flex", gap: 8, marginBottom: chatId ? 16 : 0 }}>
        <input
          type="number"
          min={0}
          value={capDraft}
          onChange={(e) => setCapDraft(e.target.value)}
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.text,
            fontSize: 14,
          }}
        />
        <button
          type="button"
          style={btnPrimaryLg}
          disabled={busy}
          onClick={() => {
            const n = Math.max(0, Math.trunc(Number(capDraft) || 0));
            setBusy(true);
            void client
              .putCollabCap(n)
              .then((r) => {
                setCap(r.cap_credits);
                setCapDraft(String(r.cap_credits));
              })
              .catch(() => setErr(t.sendFailed))
              .finally(() => setBusy(false));
          }}
        >
          {t.collabSave}
        </button>
      </div>
      {chatId ? (
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <StatChip
              label={t.collabRemaining}
              value={fmtCredits(budget?.remaining_credits ?? 0)}
            />
            <StatChip label={t.collabAccountCap} value={fmtCredits(cap)} />
            <span style={{ alignSelf: "center" }}>
              <Badge tone={budget?.can_auto ? "ok" : "neutral"}>
                {budget?.can_auto ? t.collabAutoOn : t.collabAutoOff}
              </Badge>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              style={{
                width: 96,
                padding: "9px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <button
              type="button"
              style={btnPrimaryLg}
              disabled={busy}
              onClick={() => {
                const n = Math.max(1, Math.trunc(Number(addDraft) || 0));
                setBusy(true);
                void client
                  .addChatCollabBudget(chatId, n)
                  .then(setBudget)
                  .catch(() => setErr(t.sendFailed))
                  .finally(() => setBusy(false));
              }}
            >
              {t.collabAdd}
            </button>
            <button
              type="button"
              style={btnGhostLg}
              disabled={busy || cap <= 0}
              onClick={() => {
                setBusy(true);
                void client
                  .ensureChatCollabDefault(chatId)
                  .then(setBudget)
                  .catch(() => setErr(t.sendFailed))
                  .finally(() => setBusy(false));
              }}
            >
              {t.collabApplyDefault}
            </button>
            <button
              type="button"
              style={btnGhostLg}
              disabled={busy || !(budget && budget.remaining_credits > 0)}
              onClick={() => {
                setBusy(true);
                void client
                  .releaseChatCollabBudget(chatId)
                  .then((r) => setBudget(r))
                  .catch(() => setErr(t.sendFailed))
                  .finally(() => setBusy(false));
              }}
            >
              {t.collabRelease}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AccountWalletPanel({
  client,
  messages: t,
  interfazeBaseUrl = "https://interfaze.io",
  onClose,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  interfazeBaseUrl?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<HumanWallet | null>(null);
  const [txs, setTxs] = useState<MyAgentWalletTx[]>([]);
  const [checkoutEmbedUrl, setCheckoutEmbedUrl] = useState<string | null>(null);
  const baselineBalanceRef = useRef<number | null>(null);
  const [agentRows, setAgentRows] = useState<{ agent: MyAgentSummary; balance: number | null }[]>([]);
  const [agentWalletsLoading, setAgentWalletsLoading] = useState(true);
  const [agentWalletId, setAgentWalletId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [w, list] = await Promise.all([
      client.getHumanWallet(),
      client.listHumanWalletTransactions(1, 10),
    ]);
    setWallet(w);
    setTxs(list.transactions || []);
    return w;
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void reload()
      .catch(() => {
        if (!cancelled) setError(t.accountWalletLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload, t.accountWalletLoadFailed]);

  // Agent balances load separately so a slow agent wallet never blocks the human wallet.
  const reloadAgentWallets = useCallback(async () => {
    const agents = await client.listMyAgents(20);
    const rows = await Promise.all(
      agents.map(async (agent) => {
        try {
          const w = await client.getMyAgentWallet(agent.agent_id);
          return { agent, balance: w.balance };
        } catch {
          return { agent, balance: null };
        }
      }),
    );
    setAgentRows(rows);
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    setAgentWalletsLoading(true);
    void reloadAgentWallets()
      .catch(() => {
        /* agent wallet list is optional */
      })
      .finally(() => {
        if (!cancelled) setAgentWalletsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadAgentWallets]);

  // Detail view may have changed a balance (top-up / withdraw) — refresh on return.
  function closeAgentWalletDetail() {
    setAgentWalletId(null);
    void reloadAgentWallets().catch(() => undefined);
  }

  const rechargeUrl = buildWalletCheckoutUrl({
    interfazeBaseUrl,
    returnTo: "/?account=wallet",
  });

  function openRecharge() {
    baselineBalanceRef.current = wallet?.balance ?? null;
    if (prefersInPanelCheckout(rechargeUrl)) {
      setCheckoutEmbedUrl(
        buildWalletCheckoutUrl({
          interfazeBaseUrl,
          embed: true,
          returnTo: "/?account=wallet",
        }),
      );
      return;
    }
    if (typeof window === "undefined") return;
    window.location.assign(rechargeUrl);
  }

  useEffect(() => {
    if (!checkoutEmbedUrl) return;
    let origin = "";
    try {
      origin = new URL(checkoutEmbedUrl).origin;
    } catch {
      return;
    }
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== WALLET_CREDITED_MSG) return;
      setCheckoutEmbedUrl(null);
      void reload().catch(() => undefined);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [checkoutEmbedUrl, reload]);

  useEffect(() => {
    if (!checkoutEmbedUrl) return;
    const baseline = baselineBalanceRef.current;
    const tick = async () => {
      try {
        const w = await client.getHumanWallet();
        setWallet(w);
        if (baseline != null && w.balance > baseline) {
          setCheckoutEmbedUrl(null);
          void reload().catch(() => undefined);
        }
      } catch {
        /* keep watching */
      }
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [checkoutEmbedUrl, client, reload]);

  if (agentWalletId) {
    const row = agentRows.find((r) => r.agent.agent_id === agentWalletId);
    const label = (row?.agent.name || "").trim() || t.accountWalletAgentWallets;
    return (
      <PanelChrome title={label} onClose={closeAgentWalletDetail} closeLabel={t.close}>
        <AgentOwnerWallet
          client={client}
          agentId={agentWalletId}
          messages={t}
          interfazeBaseUrl={interfazeBaseUrl}
        />
      </PanelChrome>
    );
  }

  return (
    <PanelChrome title={t.accountWallet} onClose={onClose} closeLabel={t.close}>
      <p style={sectionHint}>{t.accountWalletHint}</p>
      {loading ? (
        <EmptyText>{t.loading}</EmptyText>
      ) : error ? (
        <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              ...card,
              padding: 20,
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.16) 0%, rgba(16,185,129,0.06) 100%), #151b23",
              border: "1px solid rgba(59,130,246,0.25)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{t.walletBalance}</p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 38,
                fontWeight: 750,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtCredits(wallet?.balance ?? 0)}
            </p>
            <button
              type="button"
              onClick={openRecharge}
              style={{
                ...btnPrimaryLg,
                width: "100%",
                marginTop: 18,
                padding: "11px 16px",
                border: 0,
                cursor: "pointer",
              }}
            >
              {t.walletRechargeExternal}
            </button>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 11,
                color: colors.muted,
                lineHeight: 1.45,
                textAlign: "center",
              }}
            >
              {t.walletRechargeExternalHint}
            </p>
          </div>

          <div style={card}>
            <ChatCollabBudgetSection client={client} messages={t} />
          </div>

          <section>
            <h3 style={sectionTitle}>{t.accountWalletAgentWallets}</h3>
            {agentWalletsLoading ? (
              <EmptyText>{t.loading}</EmptyText>
            ) : agentRows.length === 0 ? (
              <EmptyText>{t.accountWalletNoAgents}</EmptyText>
            ) : (
              <div style={{ ...card, padding: 6 }}>
                {agentRows.map(({ agent, balance }) => {
                  const name = (agent.name || "").trim() || agent.agent_id;
                  return (
                    <RowButton
                      key={agent.agent_id}
                      onClick={() => setAgentWalletId(agent.agent_id)}
                    >
                      <AvatarDot label={name.slice(0, 1).toUpperCase()} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 14,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          flexShrink: 0,
                        }}
                      >
                        {balance == null ? "—" : fmtCredits(balance)}
                      </span>
                      <span aria-hidden style={{ color: colors.muted, fontSize: 15 }}>
                        ›
                      </span>
                    </RowButton>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 style={sectionTitle}>{t.accountWalletRecent}</h3>
            {txs.length === 0 ? (
              <EmptyText>{t.accountWalletEmptyTx}</EmptyText>
            ) : (
              <div style={{ ...card, padding: 6 }}>
                {txs.map((tx) => {
                  const positive = tx.amount > 0;
                  const negative = tx.amount < 0;
                  const desc = cleanTxDescription(tx.description);
                  return (
                    <div
                      key={tx.transaction_id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 10,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: positive ? "#34d399" : negative ? colors.danger : colors.muted,
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                          {txTypeLabel(tx.type, t)}
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginTop: 2,
                            fontSize: 11,
                            color: colors.muted,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {desc ? `${desc} · ` : ""}
                          {fmtTxTimeShort(tx.created_at)}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color: positive ? "#34d399" : negative ? colors.danger : colors.text,
                          flexShrink: 0,
                        }}
                      >
                        {positive ? "+" : ""}
                        {fmtCredits(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
      {checkoutEmbedUrl ? (
        <ViewportOverlay
          label={t.walletRechargeExternal}
          zIndex={10060}
          onBackdrop={() => setCheckoutEmbedUrl(null)}
        >
          <div
            style={{
              width: "min(420px, 100%)",
              height: "min(640px, 92%)",
              background: "#0a0a0a",
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <strong style={{ fontSize: 14 }}>{t.walletRechargeExternal}</strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={checkoutEmbedUrl.replace(/([?&])embed=1&?/, "$1").replace(/[?&]$/, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: colors.muted }}
                >
                  {t.accountPlanOpenWallet}
                </a>
                <button
                  type="button"
                  style={{ ...btnGhost, width: 28, height: 28, padding: 0 }}
                  onClick={() => setCheckoutEmbedUrl(null)}
                  aria-label={t.close}
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              title={t.walletRechargeExternal}
              src={checkoutEmbedUrl}
              allow="payment"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ flex: 1, width: "100%", border: 0, background: "#0a0a0a" }}
            />
          </div>
        </ViewportOverlay>
      ) : null}
    </PanelChrome>
  );
}

function storeOpenRouterUrl(base?: string): string {
  return `${(base || "https://agentplanet.org").replace(/\/+$/, "")}/store/openrouter`;
}

export function AccountKeysPanel({
  client,
  messages: t,
  agentPlanetBaseUrl = "https://agentplanet.org",
  onClose,
}: {
  client: GatewayClient;
  messages: RanchMessages;
  agentPlanetBaseUrl?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<AccountKey[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void client
      .getMyKeys()
      .then((row) => {
        if (cancelled) return;
        setKeys(row.keys || []);
      })
      .catch(() => {
        if (!cancelled) setError(t.accountKeysLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, t.accountKeysLoadFailed]);

  const storeUrl = storeOpenRouterUrl(agentPlanetBaseUrl);

  return (
    <PanelChrome title={t.accountKeys} onClose={onClose} closeLabel={t.close}>
      <p style={sectionHint}>{t.accountKeysHint}</p>
      {loading ? (
        <EmptyText>{t.loading}</EmptyText>
      ) : error ? (
        <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>
      ) : keys.length === 0 ? (
        <div style={{ marginBottom: 16 }}>
          <EmptyText>{t.accountKeysEmpty}</EmptyText>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {keys.map((key) => {
            const written = key.written_agent_name || key.written_agent_id;
            return (
              <div
                key={key.order_id}
                style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: colors.accentSoft,
                    color: "#7aa2f7",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  OR
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 650 }}>OpenRouter</span>
                    {key.status ? <Badge>{key.status}</Badge> : null}
                  </span>
                  <span
                    style={{ display: "block", marginTop: 5, fontSize: 12, color: colors.muted }}
                  >
                    {fmtTpl(t.accountPlanPriceCredits, { n: fmtCredits(key.credits_spent) })}
                  </span>
                  <span
                    style={{ display: "block", marginTop: 3, fontSize: 12, color: colors.muted }}
                  >
                    {written
                      ? fmtTpl(t.accountKeysWrittenTo, { name: written })
                      : t.accountKeysNotWritten}
                  </span>
                  {key.created_at ? (
                    <span
                      style={{ display: "block", marginTop: 3, fontSize: 11, color: colors.muted }}
                    >
                      {fmtTxTime(key.created_at)}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...btnPrimaryLg,
          display: "inline-block",
          textDecoration: "none",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {t.accountKeysBuy}
      </a>
      <p style={{ margin: 0, fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
        {t.accountKeysBuyHint}
      </p>
    </PanelChrome>
  );
}

/** Hub for user-created Agents / Subnets / Orgs — not listed in the account menu. */
export function AccountManagePanel({
  messages: t,
  onClose,
  onOpenAgents,
}: {
  messages: RanchMessages;
  onClose: () => void;
  onOpenAgents: () => void;
}) {
  const items: Array<{
    key: string;
    label: string;
    hint: string;
    comingSoon?: boolean;
    onSelect?: () => void;
  }> = [
    {
      key: "agents",
      label: t.hubAgents,
      hint: t.hubAgentsManageHint,
      onSelect: onOpenAgents,
    },
    {
      key: "subnets",
      label: t.networkSubnets,
      hint: t.hubSubnetsManageHint,
      comingSoon: true,
    },
    {
      key: "orgs",
      label: t.networkOrgs,
      hint: t.hubOrgsManageHint,
      comingSoon: true,
    },
  ];

  return (
    <PanelChrome title={t.accountManage} onClose={onClose} closeLabel={t.close}>
      <p style={sectionHint}>{t.hubManageIntro}</p>
      <div style={{ ...card, padding: 6 }}>
        {items.map((item) => {
          const disabled = !!item.comingSoon || !item.onSelect;
          return (
            <RowButton
              key={item.key}
              disabled={disabled}
              onClick={() => item.onSelect?.()}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                  {item.comingSoon ? <Badge>{t.comingSoon}</Badge> : null}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 12,
                    color: colors.muted,
                    lineHeight: 1.45,
                  }}
                >
                  {item.hint}
                </span>
              </span>
              {!disabled ? (
                <span aria-hidden style={{ color: colors.muted, fontSize: 15 }}>
                  ›
                </span>
              ) : null}
            </RowButton>
          );
        })}
      </div>
    </PanelChrome>
  );
}
