"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import {
  AUTH0_AUDIENCE,
  AUTH0_SCOPE,
  isAuth0Configured,
} from "@/lib/auth0";
import {
  notifyPlanActivated,
  resolveEmbedParentOrigin,
  withEmbedParentOrigin,
} from "@/lib/embedParent";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { isCnRegion } from "@/lib/region";
import { planCheckoutReturnHref, safeReturnTo } from "@/lib/safeReturnTo";
import CnSubscribeCheckout from "@/components/CnSubscribeCheckout";
import {
  PlanCatalog,
  PlanSheet,
  catalogCloseHref,
  findCatalogTier,
  planSheetColors,
  subscribeHref,
} from "@/components/PlanCatalog";
import { getAgentPlanetBaseUrl } from "@/lib/region";

const PLAN_USD: Record<string, { label: string; amountUsd: number }> = {
  pro: { label: "Pro", amountUsd: 20 },
  max: { label: "Max", amountUsd: 200 },
};

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

function normalizePlan(raw: string | null | undefined): string {
  const c = (raw || "").trim().toLowerCase();
  return c === "ultra" ? "max" : c;
}

function SubscribeInner() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const urlPlan = normalizePlan(searchParams.get("plan"));
  const [picked, setPicked] = useState(urlPlan);
  const planCode = PLAN_USD[picked] ? picked : "";
  const renew =
    searchParams.get("renew") === "1" || searchParams.get("renew") === "true";
  const embed = searchParams.get("embed") === "1";
  const parentOriginParam = resolveEmbedParentOrigin(searchParams.get("parent_origin"));
  const afterPayReturnTo = useMemo(
    () => safeReturnTo(searchParams.get("return_to")),
    [searchParams],
  );
  const exitHref = catalogCloseHref(searchParams);
  const notifyParent = useCallback(
    (code: string, paidUntil?: string | null) => {
      notifyPlanActivated(code, paidUntil, parentOriginParam);
    },
    [parentOriginParam],
  );
  const plan = planCode ? PLAN_USD[planCode] : undefined;
  const gateway = getGatewayBaseUrl();

  const selectPlan = useCallback(
    (code?: string) => {
      const next = code && PLAN_USD[code] ? code : "";
      setPicked(next);
      if (typeof history !== "undefined") {
        history.replaceState(null, "", subscribeHref(searchParams, next || undefined));
      }
    },
    [searchParams],
  );

  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      setPicked(normalizePlan(q.get("plan")));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const [paying, setPaying] = useState<"LOGIN" | "BILLING" | "CAPTURE" | null>(null);
  const payingLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inIframe, setInIframe] = useState(false);
  /** Order ids whose capture already activated a plan (do not re-capture). */
  const paypalCaptureDoneRef = useRef<string | null>(null);
  /** Order id with an in-flight capture; cleared on cleanup so remount can retry. */
  const paypalCaptureInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    setInIframe(window.parent !== window);
  }, []);

  const tokenGetter = useCallback(async () => {
    if (!isAuth0Configured() || !isAuthenticated) return null;
    return getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
    });
  }, [getAccessTokenSilently, isAuthenticated]);

  const cleanSubscribePath = useCallback(() => {
    const q = new URLSearchParams({ plan: planCode });
    if (renew) q.set("renew", "1");
    if (embed) q.set("embed", "1");
    if (parentOriginParam) q.set("parent_origin", parentOriginParam);
    if (afterPayReturnTo) q.set("return_to", afterPayReturnTo);
    return `/subscribe?${q.toString()}`;
  }, [planCode, renew, embed, parentOriginParam, afterPayReturnTo]);

  const promptSignIn = useCallback(
    (returnTo: string) => {
      void loginWithRedirect({
        authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
        appState: { returnTo: withEmbedParentOrigin(returnTo, parentOriginParam) },
        openUrl:
          embed && inIframe
            ? (url) => {
                const opened = window.open(url, "_blank", "noopener,noreferrer");
                if (!opened) window.location.href = url;
              }
            : undefined,
      });
    },
    [embed, inIframe, loginWithRedirect, parentOriginParam],
  );

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const q = new URLSearchParams({ plan: planCode, paypal: "success" });
    if (renew) q.set("renew", "1");
    if (embed) q.set("embed", "1");
    if (parentOriginParam) q.set("parent_origin", parentOriginParam);
    q.set("return_to", afterPayReturnTo);
    return `${window.location.origin}/subscribe?${q}`;
  }, [planCode, renew, embed, parentOriginParam, afterPayReturnTo]);

  const startPaypalCheckout = useCallback(
    async (landingPage: "LOGIN" | "BILLING") => {
      if (!plan || !planCode || payingLock.current) return;
      payingLock.current = true;
      setError(null);
      setPaying(landingPage);
      try {
        const token = await tokenGetter();
        if (!token) {
          payingLock.current = false;
          setPaying(null);
          promptSignIn(cleanSubscribePath());
          return;
        }
        const cancelQ = new URLSearchParams({
          plan: planCode,
          paypal: "cancel",
          return_to: afterPayReturnTo,
        });
        if (renew) cancelQ.set("renew", "1");
        const cancelPath = withEmbedParentOrigin(
          `/subscribe?${cancelQ.toString()}`,
          parentOriginParam,
        );
        const res = await fetch(`${gateway}/api/users/me/wallet/paypal/create-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: plan.amountUsd,
            currency: "USD",
            return_url: returnUrl,
            cancel_url: `${window.location.origin}${cancelPath}`,
            plan_code: planCode,
            landing_page: landingPage,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          order_id?: string;
          approve_url?: string | null;
          detail?: string;
        };
        if (!res.ok || !body.approve_url) {
          throw new Error(body.detail || `Create failed (${res.status})`);
        }
        const topWin = window.top || window;
        topWin.location.assign(body.approve_url);
      } catch (e) {
        payingLock.current = false;
        setPaying(null);
        setError(e instanceof Error ? e.message : "PayPal create failed");
      }
    },
    [
      afterPayReturnTo,
      cleanSubscribePath,
      gateway,
      parentOriginParam,
      plan,
      planCode,
      promptSignIn,
      renew,
      returnUrl,
      tokenGetter,
    ],
  );

  // Auth0 may complete in a sibling tab (embed) — refresh session when focus returns.
  useEffect(() => {
    if (!embed || isAuthenticated) return;
    const onFocus = () => {
      window.location.reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [embed, isAuthenticated]);

  const paypalReturn = searchParams.get("paypal");
  const paypalOrderId = (searchParams.get("token") || "").trim();

  // PayPal redirect return (idempotent per order; remount can retry if cancelled mid-flight).
  useEffect(() => {
    if (!isAuthenticated || paypalReturn !== "success" || !plan) return;
    if (!paypalOrderId) return;
    if (paypalCaptureDoneRef.current === paypalOrderId) return;
    if (paypalCaptureInFlightRef.current === paypalOrderId) return;
    paypalCaptureInFlightRef.current = paypalOrderId;
    let cancelled = false;
    setPaying("CAPTURE");
    void (async () => {
      try {
        const token = await tokenGetter();
        if (!token) throw new Error("Not signed in");
        const res = await fetch(`${gateway}/api/users/me/wallet/paypal/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ order_id: paypalOrderId }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          status?: string;
          plan_code?: string;
          paid_until?: string | null;
          detail?: string;
        };
        if (!res.ok) throw new Error(body.detail || `Capture failed (${res.status})`);
        if (body.status === "plan_activated" && body.plan_code) {
          paypalCaptureDoneRef.current = paypalOrderId;
          // Apply even if this effect instance was cleaned up — payment already succeeded.
          setSuccess(
            `${body.plan_code.toUpperCase()} active` +
              (body.paid_until
                ? ` until ${new Date(body.paid_until).toLocaleDateString()}`
                : ""),
          );
          notifyParent(body.plan_code, body.paid_until);
          if (typeof history !== "undefined") {
            history.replaceState(null, "", cleanSubscribePath());
          }
        } else {
          throw new Error("Payment captured but plan was not activated.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Capture failed");
          if (typeof history !== "undefined") {
            history.replaceState(null, "", cleanSubscribePath());
          }
        }
      } finally {
        if (paypalCaptureInFlightRef.current === paypalOrderId) {
          paypalCaptureInFlightRef.current = null;
        }
        if (!cancelled) setPaying(null);
      }
    })();
    return () => {
      cancelled = true;
      // Release in-flight claim so a remount can retry; capture API is idempotent per order.
      if (
        paypalCaptureDoneRef.current !== paypalOrderId &&
        paypalCaptureInFlightRef.current === paypalOrderId
      ) {
        paypalCaptureInFlightRef.current = null;
      }
    };
  }, [
    isAuthenticated,
    paypalReturn,
    paypalOrderId,
    plan,
    gateway,
    tokenGetter,
    notifyParent,
    cleanSubscribePath,
  ]);

  // Always leave /subscribe after a successful non-embed checkout (PayPal full-page).
  useEffect(() => {
    if (!success || embed) return;
    const href = planCheckoutReturnHref(afterPayReturnTo);
    const timer = window.setTimeout(() => {
      window.location.replace(href);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [success, embed, afterPayReturnTo]);

  if (!plan) {
    return (
      <main style={pageStyle(embed)}>
        <PlanCatalog
          market="global"
          searchParams={searchParams}
          embed={embed}
          onSelectPlan={(code) => selectPlan(code)}
        />
      </main>
    );
  }

  const tier = findCatalogTier("global", planCode);

  if (isLoading) {
    return (
      <main style={pageStyle(embed)}>
        <PlanSheet
          embed={embed}
          closeHref={exitHref}
          title="Checkout"
          onBack={() => selectPlan(undefined)}
        >
          <p style={muted}>Loading…</p>
        </PlanSheet>
      </main>
    );
  }

  if (!isAuthenticated && paypalReturn === "success" && paypalOrderId) {
    return (
      <main style={pageStyle(embed)}>
        <PlanSheet
          embed={embed}
          closeHref={exitHref}
          title="Checkout"
          onBack={() => selectPlan(undefined)}
          hint="Sign in to finish activating your paid plan."
        >
          {tier ? <TierSummary tier={tier} /> : null}
          {embed && inIframe ? (
            <p style={{ ...muted, marginBottom: 12, fontSize: 12 }}>
              Sign-in opens in a new tab. Return here after Auth0 completes.
            </p>
          ) : null}
          <button
            type="button"
            style={btnStyle}
            onClick={() => {
              const q = new URLSearchParams({
                plan: planCode,
                paypal: "success",
                token: paypalOrderId,
              });
              if (renew) q.set("renew", "1");
              if (embed) q.set("embed", "1");
              q.set("return_to", afterPayReturnTo);
              promptSignIn(`/subscribe?${q.toString()}`);
            }}
          >
            Sign in
          </button>
        </PlanSheet>
      </main>
    );
  }

  return (
    <main style={pageStyle(embed)}>
      <PlanSheet
        embed={embed}
        closeHref={exitHref}
        title="Checkout"
        onBack={() => selectPlan(undefined)}
        hint={
          `Pay $${plan.amountUsd} USD for 30 days. This does not use Wallet Credits.` +
          (renew ? " Renew stacks another 30 days from your current period." : "")
        }
      >
        {tier ? <TierSummary tier={tier} /> : null}
        <div style={totalRow}>
          <span style={{ color: planSheetColors.muted }}>Total</span>
          <strong>${plan.amountUsd} USD</strong>
        </div>
        {success ? (
          <p style={{ color: "#7dcea0", fontSize: 13, margin: "0 0 12px" }}>
            {success}
            {!embed ? " Returning to chat…" : ""}
          </p>
        ) : null}
        {error ? (
          <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
        ) : null}
        {success && !embed ? (
          <p style={{ ...muted, margin: "0 0 12px" }}>
            <Link href={afterPayReturnTo} style={linkStyle}>
              Back to Interfaze
            </Link>
          </p>
        ) : null}
        {/* Full-page approve_url redirect — SDK popup often opens about:blank in this host. */}
        {!success ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PAYPAL_CLIENT_ID ? (
              <>
                <button
                  type="button"
                  style={paypalBtnStyle}
                  disabled={paying !== null}
                  aria-busy={paying === "LOGIN"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void startPaypalCheckout("LOGIN");
                  }}
                >
                  {paying === "LOGIN" ? "Redirecting…" : "Pay with PayPal"}
                </button>
                <button
                  type="button"
                  style={cardBtnStyle}
                  disabled={paying !== null}
                  aria-busy={paying === "BILLING"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void startPaypalCheckout("BILLING");
                  }}
                >
                  {paying === "BILLING" ? "Redirecting…" : "Debit or Credit Card"}
                </button>
              </>
            ) : (
              <p style={{ color: "#ef4444", fontSize: 13 }}>PayPal is not configured.</p>
            )}
          </div>
        ) : null}
        {!embed ? (
          <p style={{ ...muted, marginTop: 16 }}>
            <button
              type="button"
              style={{ ...linkStyle, background: "none", border: 0, padding: 0, cursor: "pointer" }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectPlan(undefined);
              }}
            >
              All plans
            </button>
            {" · "}
            Need Credits top-up?{" "}
            <a href={`${getAgentPlanetBaseUrl()}/wallet?recharge=1`} style={linkStyle}>
              Open Wallet
            </a>
          </p>
        ) : null}
      </PlanSheet>
    </main>
  );
}

function TierSummary({
  tier,
}: {
  tier: NonNullable<ReturnType<typeof findCatalogTier>>;
}) {
  return (
    <article style={tierCard}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>{tier.label}</p>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        {tier.price}
      </p>
      <ul style={tierBullets}>
        {tier.bullets.map((line) => (
          <li key={line} style={tierBullet}>
            <span aria-hidden>✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function pageStyle(embed: boolean): CSSProperties {
  return {
    minHeight: embed ? "100%" : "100vh",
    background: planSheetColors.bg,
    color: planSheetColors.text,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  };
}

const muted: CSSProperties = {
  color: planSheetColors.muted,
  fontSize: 13,
  lineHeight: 1.5,
  margin: 0,
};

const linkStyle: CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontSize: 13,
};

const btnStyle: CSSProperties = {
  marginTop: 8,
  width: "100%",
  padding: "9px 12px",
  background: planSheetColors.accent,
  color: "#fff",
  border: `1px solid ${planSheetColors.accent}`,
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const paypalBtnStyle: CSSProperties = {
  ...btnStyle,
  marginTop: 0,
  position: "relative",
  isolation: "isolate",
  background: "#ffc439",
  border: "1px solid #ffc439",
  color: "#003087",
};

const cardBtnStyle: CSSProperties = {
  ...btnStyle,
  marginTop: 0,
  position: "relative",
  isolation: "isolate",
  background: "transparent",
  border: `1px solid ${planSheetColors.border}`,
  color: planSheetColors.text,
};

const totalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 12px",
  border: `1px solid ${planSheetColors.border}`,
  background: planSheetColors.card,
  borderRadius: 12,
  fontSize: 12,
  marginBottom: 16,
};

const tierCard: CSSProperties = {
  background: planSheetColors.card,
  borderRadius: 12,
  padding: "16px 16px 14px",
  border: `1px solid ${planSheetColors.border}`,
  marginBottom: 12,
};

const tierBullets: CSSProperties = {
  listStyle: "none",
  margin: "14px 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const tierBullet: CSSProperties = {
  display: "flex",
  gap: 8,
  fontSize: 12,
  color: planSheetColors.muted,
  lineHeight: 1.4,
};

function SubscribeAuthGate() {
  if (!isAuth0Configured()) {
    return (
      <main style={{ minHeight: "100vh", background: planSheetColors.bg, color: planSheetColors.text, padding: 48 }}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          Auth0 is not configured. Set NEXT_PUBLIC_AUTH0_DOMAIN and NEXT_PUBLIC_AUTH0_CLIENT_ID.
        </p>
        <Link href="/" style={{ color: "#93c5fd", fontSize: 13 }}>
          Back to Interfaze
        </Link>
      </main>
    );
  }
  return <SubscribeInner />;
}

export default function SubscribePage() {
  if (isCnRegion()) return <CnSubscribeCheckout />;
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", background: planSheetColors.bg, color: planSheetColors.muted, padding: 48 }}>
          Loading…
        </main>
      }
    >
      <SubscribeAuthGate />
    </Suspense>
  );
}
