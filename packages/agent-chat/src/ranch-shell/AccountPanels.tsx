"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  ChatCollabBudget,
  GatewayClient,
  HumanWallet,
  MyAgentWalletTx,
  PlanCatalogEntry,
  PlanUsage,
} from "../gateway";
import type { RanchChatAccount } from "../types";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

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
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <button type="button" style={btnGhost} onClick={onClose} aria-label={closeLabel}>
          ←
        </button>
        <strong style={{ fontSize: 14, flex: 1 }}>{title}</strong>
        <span style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>{children}</div>
    </div>
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        {account.picture ? (
          <img
            src={account.picture}
            alt=""
            width={72}
            height={72}
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              objectFit: "cover",
              background: colors.border,
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: colors.accentSoft,
              color: colors.accent,
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {initial}
          </span>
        )}
        <div style={{ textAlign: "center", width: "100%" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>
            {name || t.account}
          </p>
          {email ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: colors.muted }}>{email}</p>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: 28 }}>
        <h3 style={sectionTitle}>{t.accountProfile}</h3>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.55 }}>
          {t.accountProfileHint}
        </p>
      </div>
    </PanelChrome>
  );
}

const planCard: CSSProperties = {
  background: "#1a222d",
  borderRadius: 12,
  padding: "16px 16px 14px",
  border: `1px solid ${colors.border}`,
};

const planSectionLabel: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 500,
  color: colors.muted,
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
        height: 5,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: tone === "accent" ? "#7aa2f7" : "rgba(232,238,245,0.55)",
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

/** Exact Interfaze hosts (avoid `startsWith("interfaze.")` typosquat). */
function isInterfazeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "interfaze.io" ||
    h.endsWith(".interfaze.io") ||
    h === "interfaze.acnlabs.cn" ||
    h.endsWith(".interfaze.acnlabs.cn") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
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

export function AccountPlanUsagePanel({
  client,
  messages: t,
  locale = "en",
  agentPlanetBaseUrl = "https://agentplanet.org",
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
  const [confirmTier, setConfirmTier] = useState<PlanCatalogEntry | null>(null);
  const [confirmIsRenew, setConfirmIsRenew] = useState(false);
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
  const rechargeUrl = `${agentPlanetBaseUrl.replace(/\/$/, "")}/wallet?recharge=1`;
  /**
   * Prefer Host-injected interfazeBaseUrl. If already on an Interfaze host,
   * use same origin (WeChat /subscribe). Do not fall back to AgentPlanet origin —
   * plan checkout lives on Interfaze, not Host wallet.
   */
  const subscribeBase = (() => {
    const fromProp = (interfazeBaseUrl || "").replace(/\/$/, "");
    if (typeof window !== "undefined") {
      const { hostname, origin } = window.location;
      if (isInterfazeHostname(hostname)) return origin;
    }
    return fromProp || "https://interfaze.io";
  })();

  function clearConfirm() {
    setConfirmTier(null);
    setConfirmIsRenew(false);
  }

  function buildSubscribeUrl(code: string, renew: boolean, embed: boolean): string {
    const u = new URL(`${subscribeBase}/subscribe`);
    u.searchParams.set("plan", code);
    if (renew) u.searchParams.set("renew", "1");
    if (embed) {
      u.searchParams.set("embed", "1");
      if (typeof window !== "undefined") {
        u.searchParams.set("parent_origin", window.location.origin);
      }
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
    setBuyMsg(null);
    setBuyMsgTone("muted");
    setConfirmIsRenew(Boolean(opts?.renew));
    setConfirmTier(tier);
  }

  function tierFiatLabel(tier: PlanCatalogEntry): string {
    if (tier.fiat_amount != null && tier.fiat_amount > 0) {
      const n = String(tier.fiat_amount);
      if ((tier.fiat_currency || "").toUpperCase() === "CNY") {
        return fmtTpl(t.accountPlanPriceFiatCny, { n });
      }
      return fmtTpl(t.accountPlanPriceFiatUsd, { n });
    }
    if (tier.price_credits != null && tier.price_credits > 0) {
      return fmtTpl(t.accountPlanPriceCredits, { n: fmtCredits(tier.price_credits) });
    }
    return "—";
  }

  async function confirmBuyPlan() {
    if (!confirmTier) return;
    const code = confirmTier.code.toLowerCase() === "ultra" ? "max" : confirmTier.code.toLowerCase();
    const wasRenew = confirmIsRenew;
    setBuyBusy(code);
    setBuyMsg(null);
    setBuyMsgTone("muted");
    try {
      let checkoutUrl = buildSubscribeUrl(code, wasRenew, true);
      try {
        const row = await client.getPlanCheckout(code);
        if (row.checkout_url) {
          const trusted = resolveTrustedCheckoutUrl(row.checkout_url);
          if (trusted) {
            const u = new URL(trusted);
            if (wasRenew) u.searchParams.set("renew", "1");
            u.searchParams.set("embed", "1");
            if (typeof window !== "undefined") {
              u.searchParams.set("parent_origin", window.location.origin);
            }
            checkoutUrl = u.toString();
          }
        }
      } catch {
        // Fall back to Interfaze /subscribe constructed above.
      }
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
      clearConfirm();
      setCheckoutEmbedUrl(checkoutUrl);
      setBuyMsgTone("muted");
      setBuyMsg(t.accountPlanCheckoutPending);
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
            <h3 style={{ ...sectionTitle, marginBottom: 10 }}>{t.accountPlanCurrent}</h3>
            <div style={planCard}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {planLabel}
                </span>
                <span style={{ fontSize: 14, color: colors.muted }}>
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
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  style={{ ...btnGhost, padding: "7px 12px", fontSize: 13 }}
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.accountPlanAdjustTitle}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            if (buyBusy) return;
            clearConfirm();
            // Keep checkout watch + success/pending message across dismiss.
            setAdjustOpen(false);
          }}
        >
          <div
            style={{
              width: "min(360px, 100%)",
              maxHeight: "90%",
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
                  clearConfirm();
                  setAdjustOpen(false);
                }}
                aria-label={t.close}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                      background: isCurrent ? "#1e2733" : "#161c24",
                    }}
                  >
                    {isCurrent ? (
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          color: colors.muted,
                        }}
                      >
                        {t.accountPlanCurrent}
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
                        disabled={busy || buyBusy != null || confirmTier != null}
                        style={{
                          ...btnPrimary,
                          width: "100%",
                          marginTop: 16,
                          padding: "9px 12px",
                          opacity: busy || buyBusy != null || confirmTier != null ? 0.7 : 1,
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
                        disabled={busy || buyBusy != null || confirmTier != null}
                        style={{
                          ...btnPrimary,
                          width: "100%",
                          marginTop: 16,
                          padding: "9px 12px",
                          opacity: busy || buyBusy != null || confirmTier != null ? 0.7 : 1,
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
            {buyMsg && !confirmTier ? (
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
                    target="_blank"
                    rel="noreferrer"
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

            {confirmTier ? (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t.accountPlanBuyConfirmTitle}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  background: "rgba(0,0,0,0.62)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    background: "#1a222d",
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                    padding: "16px 14px 14px",
                  }}
                >
                  <strong style={{ fontSize: 15 }}>{t.accountPlanBuyConfirmTitle}</strong>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 13,
                      color: colors.muted,
                      lineHeight: 1.5,
                    }}
                  >
                    {fmtTpl(
                      confirmIsRenew
                        ? t.accountPlanBuyConfirmRenewBody
                        : t.accountPlanBuyConfirmBody,
                      {
                        plan:
                          locale === "zh"
                            ? confirmTier.label_zh || confirmTier.label
                            : confirmTier.label,
                        price: tierFiatLabel(confirmTier),
                        pack: fmtCredits(confirmTier.dialog_allowance_credits ?? 0),
                      },
                    )}
                  </p>
                  {buyMsg && buyMsgTone === "danger" ? (
                    <div style={{ marginTop: 12 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: colors.danger,
                          lineHeight: 1.45,
                        }}
                      >
                        {buyMsg}
                      </p>
                      {buyMsg === t.accountPlanNeedCredits ? (
                        <a
                          href={rechargeUrl}
                          target="_blank"
                          rel="noreferrer"
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
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 16,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      disabled={buyBusy != null}
                      style={{ ...btnGhost, padding: "8px 12px" }}
                      onClick={() => {
                        clearConfirm();
                        setBuyMsg(null);
                      }}
                    >
                      {t.accountPlanBuyCancel}
                    </button>
                    <button
                      type="button"
                      disabled={buyBusy != null}
                      style={{
                        ...btnPrimary,
                        padding: "8px 12px",
                        opacity: buyBusy != null ? 0.7 : 1,
                      }}
                      onClick={() => void confirmBuyPlan()}
                    >
                      {buyBusy ? t.accountPlanBuyBusy : t.accountPlanBuyConfirm}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {checkoutEmbedUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={locale === "zh" ? "界面订阅" : "Interfaze Subscribe"}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
          onClick={() => setCheckoutEmbedUrl(null)}
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
              style={{ flex: 1, width: "100%", border: 0, background: "#0a0a0a" }}
            />
          </div>
        </div>
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
      <p style={{ margin: "0 0 12px", fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
        {t.collabBudgetHint}
      </p>
      {err ? (
        <p style={{ color: colors.danger, fontSize: 12, margin: "0 0 8px" }}>{err}</p>
      ) : null}
      <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
        {t.collabAccountCap}
      </label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          type="number"
          min={0}
          value={capDraft}
          onChange={(e) => setCapDraft(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.text,
            fontSize: 14,
          }}
        />
        <button
          type="button"
          style={btnPrimary}
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
        <>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: colors.muted }}>
            {t.collabRemaining}:{" "}
            <strong style={{ color: colors.text }}>
              {fmtCredits(budget?.remaining_credits ?? 0)}
            </strong>
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: colors.muted }}>
            {budget?.can_auto ? t.collabAutoOn : t.collabAutoOff}
            {cap > 0 ? ` · ${t.collabAccountCap} ${cap}` : ""}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input
              type="number"
              min={1}
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              style={{
                width: 88,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <button
              type="button"
              style={btnPrimary}
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
              style={btnGhost}
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
              style={btnGhost}
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
        </>
      ) : null}
    </div>
  );
}

export function AccountWalletPanel({
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
  const [wallet, setWallet] = useState<HumanWallet | null>(null);
  const [txs, setTxs] = useState<MyAgentWalletTx[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      client.getHumanWallet(),
      client.listHumanWalletTransactions(1, 10),
    ])
      .then(([w, list]) => {
        if (cancelled) return;
        setWallet(w);
        setTxs(list.transactions || []);
      })
      .catch(() => {
        if (!cancelled) setError(t.accountWalletLoadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, t.accountWalletLoadFailed]);

  const rechargeUrl = `${agentPlanetBaseUrl.replace(/\/$/, "")}/wallet`;

  return (
    <PanelChrome title={t.accountWallet} onClose={onClose} closeLabel={t.close}>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
        {t.accountWalletHint}
      </p>
      {loading ? (
        <p style={{ color: colors.muted, fontSize: 13 }}>{t.loading}</p>
      ) : error ? (
        <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>
      ) : (
        <>
          <h3 style={sectionTitle}>{t.walletTab}</h3>
          <p style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {fmtCredits(wallet?.balance ?? 0)}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: colors.muted }}>
            {t.walletBalance}
          </p>
          <a
            href={rechargeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnPrimary,
              display: "inline-block",
              textDecoration: "none",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {t.walletRechargeExternal}
          </a>
          <p style={{ margin: "0 0 16px", fontSize: 11, color: colors.muted, lineHeight: 1.45 }}>
            {t.walletRechargeExternalHint}
          </p>
          <div style={{ marginBottom: 24 }}>
            <ChatCollabBudgetSection client={client} messages={t} />
          </div>
          <h3 style={sectionTitle}>{t.accountWalletRecent}</h3>
          {txs.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>{t.accountWalletEmptyTx}</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {txs.map((tx) => (
                <li
                  key={tx.transaction_id}
                  style={{
                    padding: "10px 0",
                    borderBottom: `1px solid ${colors.border}`,
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                      {tx.type}
                      {tx.description ? (
                        <span style={{ fontWeight: 400, color: colors.muted }}> · {tx.description}</span>
                      ) : null}
                    </span>
                    <span style={{ fontSize: 11, color: colors.muted }}>{fmtTxTime(tx.created_at)}</span>
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 650,
                      color: tx.amount < 0 ? colors.danger : colors.text,
                      flexShrink: 0,
                    }}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {fmtCredits(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
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
        <button type="button" style={btnGhost} onClick={onClose} aria-label={t.close}>
          ←
        </button>
        <strong style={{ fontSize: 14, flex: 1 }}>{t.accountManage}</strong>
        <span style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "16px 0" }}>
        <div style={{ padding: "0 14px 10px" }}>
          <p style={sectionTitle}>{t.hubManageSection}</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
            {t.hubManageIntro}
          </p>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => {
            const disabled = !!item.comingSoon || !item.onSelect;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  title={item.comingSoon ? t.comingSoon : undefined}
                  onClick={() => item.onSelect?.()}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: disabled ? colors.muted : colors.text,
                    padding: "12px 14px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: disabled ? 0.8 : 1,
                  }}
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
                      {item.comingSoon ? (
                        <span style={{ fontSize: 11, fontWeight: 500, color: colors.muted }}>
                          {t.comingSoon}
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontSize: 11,
                        color: colors.muted,
                        lineHeight: 1.45,
                      }}
                    >
                      {item.hint}
                    </span>
                  </span>
                  {!disabled ? (
                    <span style={{ color: colors.muted, fontSize: 14 }}>›</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
