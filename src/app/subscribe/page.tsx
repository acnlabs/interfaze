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
import CnSubscribeCheckout from "@/components/CnSubscribeCheckout";

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
  const planCode = normalizePlan(searchParams.get("plan"));
  const renew =
    searchParams.get("renew") === "1" || searchParams.get("renew") === "true";
  const embed = searchParams.get("embed") === "1";
  const parentOriginParam = resolveEmbedParentOrigin(searchParams.get("parent_origin"));
  const notifyParent = useCallback(
    (code: string, paidUntil?: string | null) => {
      notifyPlanActivated(code, paidUntil, parentOriginParam);
    },
    [parentOriginParam],
  );
  const plan = PLAN_USD[planCode];
  const gateway = getGatewayBaseUrl();

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inIframe, setInIframe] = useState(false);
  const paypalCaptureDoneRef = useRef<string | null>(null);

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
    return `/subscribe?${q.toString()}`;
  }, [planCode, renew, embed, parentOriginParam]);

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const q = new URLSearchParams({ plan: planCode, paypal: "success" });
    if (renew) q.set("renew", "1");
    if (embed) q.set("embed", "1");
    if (parentOriginParam) q.set("parent_origin", parentOriginParam);
    return `${window.location.origin}/subscribe?${q}`;
  }, [planCode, renew, embed, parentOriginParam]);

  // Auth0 may complete in a sibling tab (embed) — refresh session when focus returns.
  useEffect(() => {
    if (!embed || isAuthenticated) return;
    const onFocus = () => {
      window.location.reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [embed, isAuthenticated]);

  // PayPal redirect return (one-shot per order id; strip success params after).
  useEffect(() => {
    if (!isAuthenticated || searchParams.get("paypal") !== "success" || !plan) return;
    const orderId = (searchParams.get("token") || "").trim();
    if (!orderId) return;
    if (paypalCaptureDoneRef.current === orderId) return;
    paypalCaptureDoneRef.current = orderId;
    let cancelled = false;
    setPaying(true);
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
          body: JSON.stringify({ order_id: orderId }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          status?: string;
          plan_code?: string;
          paid_until?: string | null;
          detail?: string;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(body.detail || `Capture failed (${res.status})`);
        if (body.status === "plan_activated" && body.plan_code) {
          setSuccess(
            `${body.plan_code.toUpperCase()} active` +
              (body.paid_until
                ? ` until ${new Date(body.paid_until).toLocaleDateString()}`
                : ""),
          );
          notifyParent(body.plan_code, body.paid_until);
        } else {
          setError("Payment captured but plan was not activated.");
        }
      } catch (e) {
        if (!cancelled) {
          // Allow retry on hard failure (network / capture error).
          paypalCaptureDoneRef.current = null;
          setError(e instanceof Error ? e.message : "Capture failed");
        }
      } finally {
        if (!cancelled) {
          setPaying(false);
          if (typeof history !== "undefined") {
            history.replaceState(null, "", cleanSubscribePath());
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    searchParams,
    plan,
    gateway,
    tokenGetter,
    notifyParent,
    cleanSubscribePath,
  ]);

  if (!plan) {
    return (
      <main style={pageStyle(embed)}>
        {!embed ? <Header /> : null}
        <div style={cardStyle}>
          <h1 style={titleStyle}>Interfaze Subscribe</h1>
          <p style={muted}>Choose Pro or Max from Plan & Usage in the chat shell.</p>
          {!embed ? (
            <Link href="/" style={linkStyle}>
              Back to Interfaze
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main style={pageStyle(embed)}>
        <p style={{ ...muted, padding: 48, textAlign: "center" }}>Loading…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={pageStyle(embed)}>
        {!embed ? <Header /> : null}
        <div style={cardStyle}>
          <h1 style={titleStyle}>Subscribe {plan.label}</h1>
          <p style={muted}>Sign in to pay ${plan.amountUsd} for 30 days.</p>
          {embed && inIframe ? (
            <p style={{ ...muted, marginBottom: 8, fontSize: 12 }}>
              Sign-in opens in a new tab. Return here after Auth0 completes.
            </p>
          ) : null}
          <button
            type="button"
            style={btnStyle}
            onClick={() =>
              void loginWithRedirect({
                authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
                appState: {
                  returnTo: withEmbedParentOrigin(
                    `/subscribe?plan=${planCode}${renew ? "&renew=1" : ""}${embed ? "&embed=1" : ""}`,
                    parentOriginParam,
                  ),
                },
                // Auth0 blocks iframe embeds — open top-level authorize URL in a new tab.
                openUrl:
                  embed && inIframe
                    ? (url) => {
                        const opened = window.open(url, "_blank", "noopener,noreferrer");
                        if (!opened) window.location.href = url;
                      }
                    : undefined,
              })
            }
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle(embed)}>
      {!embed ? <Header /> : null}
      <div style={cardStyle}>
        <p style={{ ...muted, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Interfaze
        </p>
        <h1 style={titleStyle}>Subscribe {plan.label}</h1>
        <p style={muted}>
          Pay ${plan.amountUsd} USD for 30 days. This does not use Wallet Credits.
          {renew ? " Renew stacks another 30 days from your current period." : ""}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 12px",
            border: "1px solid #1f1f1f",
            background: "#0d0d0d",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          <span style={{ color: "#6b7280" }}>Total</span>
          <strong>${plan.amountUsd} USD</strong>
        </div>
        {success ? <p style={{ color: "#10b981", fontSize: 13 }}>{success}</p> : null}
        {error ? <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p> : null}
        {/* Full-page approve_url redirect — SDK popup often opens about:blank in this host. */}
        {!success && PAYPAL_CLIENT_ID ? (
          <button
            type="button"
            style={paypalBtnStyle}
            disabled={paying}
            onClick={() => {
              void (async () => {
                setError(null);
                setPaying(true);
                try {
                  const token = await tokenGetter();
                  if (!token) throw new Error("Not signed in");
                  const cancelPath = withEmbedParentOrigin(
                    `/subscribe?plan=${planCode}&paypal=cancel${renew ? "&renew=1" : ""}`,
                    parentOriginParam,
                  );
                  const res = await fetch(
                    `${gateway}/api/users/me/wallet/paypal/create-order`,
                    {
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
                      }),
                    },
                  );
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
                  setPaying(false);
                  setError(e instanceof Error ? e.message : "PayPal create failed");
                }
              })();
            }}
          >
            {paying ? "Redirecting…" : "Pay with PayPal"}
          </button>
        ) : !success ? (
          <p style={{ color: "#ef4444", fontSize: 13 }}>PayPal is not configured.</p>
        ) : null}
        {!embed ? (
          <p style={{ ...muted, marginTop: 20 }}>
            Need Credits top-up?{" "}
            <a href="https://agentplanet.org/wallet?recharge=1" style={linkStyle}>
              Open Wallet
            </a>
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Header() {
  return (
    <header
      style={{
        borderBottom: "1px solid #1f1f1f",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Link href="/" style={{ ...linkStyle, fontWeight: 700, color: "#f5f5f5" }}>
        Interfaze
      </Link>
    </header>
  );
}

function pageStyle(embed: boolean): CSSProperties {
  return {
    minHeight: embed ? "100%" : "100vh",
    background: "#0a0a0a",
    color: "#f5f5f5",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  };
}

const cardStyle: CSSProperties = {
  maxWidth: 400,
  margin: "0 auto",
  padding: "40px 20px",
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: "8px 0 10px",
};

const muted: CSSProperties = {
  color: "#6b7280",
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
  marginTop: 16,
  width: "100%",
  padding: "10px 12px",
  background: "#2563eb",
  color: "#fff",
  border: 0,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const paypalBtnStyle: CSSProperties = {
  ...btnStyle,
  background: "#ffc439",
  color: "#003087",
  marginTop: 8,
};

function SubscribeAuthGate() {
  if (!isAuth0Configured()) {
    return (
      <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: 48 }}>
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
        <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#6b7280", padding: 48 }}>
          Loading…
        </main>
      }
    >
      <SubscribeAuthGate />
    </Suspense>
  );
}
