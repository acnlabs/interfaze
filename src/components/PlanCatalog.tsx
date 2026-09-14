"use client";

import Link from "next/link";
import { useEffect, type CSSProperties, type ReactNode } from "react";

export type PlanMarket = "global" | "cn";

export type CatalogTier = {
  code: "free" | "pro" | "max";
  label: string;
  price: string;
  blurb: string;
  bullets: string[];
  purchasable: boolean;
};

export const planSheetColors = {
  bg: "#0f1419",
  dialog: "#141a22",
  card: "#161c24",
  border: "rgba(255,255,255,0.06)",
  text: "#e8eef5",
  muted: "#94a3b8",
  accent: "#3b82f6",
};

const colors = planSheetColors;

const GLOBAL_TIERS: CatalogTier[] = [
  {
    code: "free",
    label: "Free",
    price: "Pay as you go",
    blurb:
      "No subscription fee and no included pack — pay as you go from your Wallet.",
    bullets: ["Included dialog usage", "Pay as you go"],
    purchasable: false,
  },
  {
    code: "pro",
    label: "Pro",
    price: "$20/mo",
    blurb:
      "Pay with PayPal for 30 days. Includes a matching dialog usage pack for billable chats (official + marketplace); your own agents stay free. Usage beyond the pack uses Wallet Credits.",
    bullets: ["2,000 included dialog usage", "Pay as you go"],
    purchasable: true,
  },
  {
    code: "max",
    label: "Max",
    price: "$200/mo",
    blurb:
      "Pay with PayPal for 30 days. Includes a matching dialog usage pack for billable chats (official + marketplace); your own agents stay free. Usage beyond the pack uses Wallet Credits.",
    bullets: ["20,000 included dialog usage", "Pay as you go"],
    purchasable: true,
  },
];

const CN_TIERS: CatalogTier[] = [
  {
    code: "free",
    label: "免费",
    price: "按量",
    blurb: "无订阅费、无含包，对话从钱包按量扣费。",
    bullets: ["含包对话用量", "按量"],
    purchasable: false,
  },
  {
    code: "pro",
    label: "Pro",
    price: "¥58/月",
    blurb:
      "用法币订阅 30 天。含等额对话用量包（官方 + 市场他人 agent 的有偿对话）；自有 agent 仍免费。超出部分从钱包按量扣。订阅不扣钱包星币。",
    bullets: ["含对话用量 5,800", "按量"],
    purchasable: true,
  },
  {
    code: "max",
    label: "Max",
    price: "¥498/月",
    blurb:
      "用法币订阅 30 天。含等额对话用量包（官方 + 市场他人 agent 的有偿对话）；自有 agent 仍免费。超出部分从钱包按量扣。订阅不扣钱包星币。",
    bullets: ["含对话用量 49,800", "按量"],
    purchasable: true,
  },
];

const COPY = {
  global: {
    brand: "Interfaze",
    title: "Interfaze plans",
    hint: "Pick a plan, then pay with PayPal. Subscription does not use Wallet Credits.",
    cta: "Subscribe",
    open: "Open Interfaze",
    close: "Close",
  },
  cn: {
    brand: "界面",
    title: "界面方案",
    hint: "先选档，再微信支付。订计划不扣星币。",
    cta: "订阅",
    open: "打开界面",
    close: "关闭",
  },
} as const;

export function subscribeHref(
  searchParams: { get: (key: string) => string | null },
  plan?: string,
): string {
  const q = new URLSearchParams();
  if (plan) q.set("plan", plan);
  for (const key of ["renew", "embed", "parent_origin", "return_to"] as const) {
    const v = searchParams.get(key);
    if (v) q.set(key, v);
  }
  const s = q.toString();
  return s ? `/subscribe?${s}` : "/subscribe";
}

export function catalogCloseHref(searchParams: { get: (key: string) => string | null }): string {
  const raw = (searchParams.get("return_to") || "").trim();
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export function findCatalogTier(market: PlanMarket, code: string): CatalogTier | null {
  const tiers = market === "cn" ? CN_TIERS : GLOBAL_TIERS;
  return tiers.find((t) => t.code === code) ?? null;
}

/** Same-path query changes (`/subscribe?plan=pro` → `/subscribe`) need a real load. */
export function planGo(href: string) {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}

export function PlanSheet({
  embed,
  closeHref,
  title,
  brand = "Interfaze",
  closeLabel = "Close",
  hint,
  wide = false,
  onBack,
  backLabel = "All plans",
  children,
}: {
  embed: boolean;
  closeHref: string;
  title: string;
  brand?: string;
  closeLabel?: string;
  hint?: string;
  wide?: boolean;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      planGo(closeHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed, closeHref, onBack]);

  const dismiss = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (embed) return;
    if (e.target !== e.currentTarget) return;
    planGo(closeHref);
  };

  return (
    <div
      style={overlay(embed)}
      role="presentation"
      onMouseDown={dismiss}
    >
      <div
        style={{
          ...dialog,
          width: wide ? "min(920px, 100%)" : "min(400px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-sheet-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={headerRow}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
            {onBack ? (
              <button
                type="button"
                style={closeBtn}
                aria-label={backLabel}
                title={backLabel}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBack();
                }}
              >
                ←
              </button>
            ) : null}
            <div>
              <p style={brandStyle}>{brand}</p>
              <h1 id="plan-sheet-title" style={titleStyle}>
                {title}
              </h1>
            </div>
          </div>
          {embed ? null : (
            <button
              type="button"
              style={closeBtn}
              aria-label={closeLabel}
              title={closeLabel}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                planGo(closeHref);
              }}
            >
              ×
            </button>
          )}
        </div>
        {hint ? <p style={hintStyle}>{hint}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function PlanCatalog({
  market,
  searchParams,
  embed,
  onSelectPlan,
}: {
  market: PlanMarket;
  searchParams: { get: (key: string) => string | null };
  embed: boolean;
  onSelectPlan?: (code: string) => void;
}) {
  const copy = COPY[market];
  const tiers = market === "cn" ? CN_TIERS : GLOBAL_TIERS;
  const home = catalogCloseHref(searchParams);

  return (
    <PlanSheet
      embed={embed}
      closeHref={home}
      brand={copy.brand}
      title={copy.title}
      hint={copy.hint}
      closeLabel={copy.close}
      wide
    >
      <style>{`
        .plan-catalog-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          align-items: stretch;
          gap: 12px;
        }
      `}</style>
      <div className="plan-catalog-grid">
        {tiers.map((tier) => (
          <article key={tier.code} style={card}>
            <p style={name}>{tier.label}</p>
            <p style={price}>{tier.price}</p>
            <p style={blurb}>{tier.blurb}</p>
            <ul style={bullets}>
              {tier.bullets.map((line) => (
                <li key={line} style={bullet}>
                  <span aria-hidden style={{ color: colors.text }}>
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {tier.purchasable ? (
              onSelectPlan ? (
                <button
                  type="button"
                  style={{ ...cta, cursor: "pointer" }}
                  onClick={() => onSelectPlan(tier.code)}
                >
                  {copy.cta}
                </button>
              ) : (
                <Link href={subscribeHref(searchParams, tier.code)} style={cta}>
                  {copy.cta}
                </Link>
              )
            ) : embed ? (
              <span style={{ marginTop: "auto" }} />
            ) : (
              <Link href={home} style={ghost}>
                {copy.open}
              </Link>
            )}
          </article>
        ))}
      </div>
    </PlanSheet>
  );
}

function overlay(embed: boolean): CSSProperties {
  return {
    minHeight: embed ? "100%" : "100vh",
    background: embed ? "transparent" : colors.bg,
    color: colors.text,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: embed ? 16 : 24,
  };
}

const dialog: CSSProperties = {
  background: colors.dialog,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  padding: "20px 18px 16px",
  boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 4,
};

const closeBtn: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  color: colors.text,
  textDecoration: "none",
  fontSize: 18,
  lineHeight: 1,
  background: "transparent",
  cursor: "pointer",
};

const brandStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.muted,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
};

const hintStyle: CSSProperties = {
  margin: "8px 0 16px",
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.muted,
};

const card: CSSProperties = {
  position: "relative",
  background: colors.card,
  borderRadius: 12,
  padding: "16px 16px 14px",
  border: `1px solid ${colors.border}`,
  display: "flex",
  flexDirection: "column",
};

const name: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 650 };

const price: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const blurb: CSSProperties = {
  margin: "12px 0 0",
  fontSize: 12,
  color: colors.muted,
  lineHeight: 1.5,
};

const bullets: CSSProperties = {
  listStyle: "none",
  margin: "14px 0 16px",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const bullet: CSSProperties = {
  display: "flex",
  gap: 8,
  fontSize: 12,
  color: colors.muted,
  lineHeight: 1.4,
};

const cta: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "auto",
  padding: "9px 12px",
  textAlign: "center",
  background: colors.accent,
  border: `1px solid ${colors.accent}`,
  color: "#fff",
  fontWeight: 600,
  fontSize: 12,
  textDecoration: "none",
  borderRadius: 8,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const ghost: CSSProperties = {
  ...cta,
  background: "transparent",
  border: `1px solid ${colors.border}`,
  color: colors.text,
};
