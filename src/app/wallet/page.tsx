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
  notifyWalletCredited,
  resolveEmbedParentOrigin,
  withEmbedParentOrigin,
} from "@/lib/embedParent";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { isCnRegion } from "@/lib/region";
import { safeReturnTo, walletCheckoutReturnHref } from "@/lib/safeReturnTo";
import CnWalletCheckout from "@/components/CnWalletCheckout";
import { PlanSheet, catalogCloseHref, planSheetColors } from "@/components/PlanCatalog";

const CREDITS_PER_USD = 100;
const PRESET_AMOUNTS_USD = [10, 25, 50, 100];
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

type RechargeQuote = {
  channel: string;
  credit_amount: number;
  channel_fee: number;
  charge_amount: number;
  credits: number;
  currency: string;
};

function WalletInner() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const embed = searchParams.get("embed") === "1";
  const parentOriginParam = resolveEmbedParentOrigin(searchParams.get("parent_origin"));
  const afterPayReturnTo = useMemo(
    () => safeReturnTo(searchParams.get("return_to"), "/?account=wallet"),
    [searchParams],
  );
  const exitHref = catalogCloseHref(searchParams) || afterPayReturnTo;
  const gateway = getGatewayBaseUrl();

  const [selectedUsd, setSelectedUsd] = useState<number | null>(10);
  const [customUsd, setCustomUsd] = useState("");
  const [quote, setQuote] = useState<RechargeQuote | null>(null);
  const [paying, setPaying] = useState<"LOGIN" | "BILLING" | "CAPTURE" | null>(null);
  const payingLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inIframe, setInIframe] = useState(false);
  const paypalCaptureDoneRef = useRef<string | null>(null);
  const paypalCaptureInFlightRef = useRef<string | null>(null);

  const faceUsd = useMemo(() => {
    const custom = Number(customUsd);
    if (customUsd.trim() && Number.isFinite(custom) && custom > 0) return Math.round(custom * 100) / 100;
    return selectedUsd && selectedUsd > 0 ? selectedUsd : 0;
  }, [customUsd, selectedUsd]);

  useEffect(() => {
    setInIframe(window.parent !== window);
  }, []);

  const tokenGetter = useCallback(async () => {
    if (!isAuth0Configured() || !isAuthenticated) return null;
    return getAccessTokenSilently({
      authorizationParams: { audience: AUTH0_AUDIENCE, scope: AUTH0_SCOPE },
    });
  }, [getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    if (faceUsd <= 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      channel: "paypal",
      amount: String(faceUsd),
    });
    void fetch(`${gateway}/api/users/me/wallet/recharge/quote?${params}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as RechargeQuote & { detail?: string };
        if (!res.ok) throw new Error(body.detail || `Quote failed (${res.status})`);
        if (!cancelled) setQuote(body);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [faceUsd, gateway]);

  const cleanWalletPath = useCallback(() => {
    const q = new URLSearchParams();
    if (embed) q.set("embed", "1");
    if (parentOriginParam) q.set("parent_origin", parentOriginParam);
    if (afterPayReturnTo) q.set("return_to", afterPayReturnTo);
    const s = q.toString();
    return s ? `/wallet?${s}` : "/wallet";
  }, [embed, parentOriginParam, afterPayReturnTo]);

  const returnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const q = new URLSearchParams({ paypal: "success", return_to: afterPayReturnTo });
    if (embed) q.set("embed", "1");
    if (parentOriginParam) q.set("parent_origin", parentOriginParam);
    return `${window.location.origin}/wallet?${q}`;
  }, [afterPayReturnTo, embed, parentOriginParam]);

  const startPaypalCheckout = useCallback(
    async (landingPage: "LOGIN" | "BILLING") => {
      if (faceUsd <= 0 || payingLock.current) return;
      payingLock.current = true;
      setError(null);
      setPaying(landingPage);
      try {
        const token = await tokenGetter();
        if (!token) throw new Error("Not signed in");
        const cancelQ = new URLSearchParams({
          paypal: "cancel",
          return_to: afterPayReturnTo,
        });
        const cancelPath = withEmbedParentOrigin(
          `/wallet?${cancelQ.toString()}`,
          parentOriginParam,
        );
        const res = await fetch(`${gateway}/api/users/me/wallet/paypal/create-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: faceUsd,
            currency: "USD",
            return_url: returnUrl,
            cancel_url: `${window.location.origin}${cancelPath}`,
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
    [afterPayReturnTo, faceUsd, gateway, parentOriginParam, returnUrl, tokenGetter],
  );

  const paypalReturn = searchParams.get("paypal");
  const paypalOrderId = (searchParams.get("token") || "").trim();

  useEffect(() => {
    if (!isAuthenticated || paypalReturn !== "success") return;
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
          balance?: number;
          credits_added?: number;
          detail?: string;
        };
        if (!res.ok) throw new Error(body.detail || `Capture failed (${res.status})`);
        if (body.status === "plan_activated") {
          throw new Error("This payment was for a plan, not Credits. Open Plan & Usage.");
        }
        paypalCaptureDoneRef.current = paypalOrderId;
        setSuccess(
          body.balance != null
            ? `Balance ${Math.trunc(body.balance).toLocaleString()} Credits`
            : "Credits added",
        );
        notifyWalletCredited(body.balance ?? null, parentOriginParam);
        if (typeof history !== "undefined") {
          history.replaceState(null, "", cleanWalletPath());
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Capture failed");
          if (typeof history !== "undefined") {
            history.replaceState(null, "", cleanWalletPath());
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
    gateway,
    tokenGetter,
    parentOriginParam,
    cleanWalletPath,
  ]);

  useEffect(() => {
    if (paypalReturn === "cancel") {
      setError("Payment cancelled.");
      if (typeof history !== "undefined") history.replaceState(null, "", cleanWalletPath());
    }
  }, [paypalReturn, cleanWalletPath]);

  useEffect(() => {
    if (!success || embed) return;
    const href = walletCheckoutReturnHref(afterPayReturnTo);
    const timer = window.setTimeout(() => {
      window.location.replace(href);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [success, embed, afterPayReturnTo]);

  if (isLoading) {
    return (
      <main style={pageStyle(embed)}>
        <PlanSheet embed={embed} closeHref={exitHref} title="Add Credits">
          <p style={muted}>Loading…</p>
        </PlanSheet>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={pageStyle(embed)}>
        <PlanSheet
          embed={embed}
          closeHref={exitHref}
          title="Add Credits"
          hint={
            paypalReturn === "success" && paypalOrderId
              ? "Sign in to finish crediting your wallet."
              : "Sign in to add Credits. 100 Credits = $1. Channel fee is listed separately."
          }
        >
          {embed && inIframe ? (
            <p style={{ ...muted, marginBottom: 12, fontSize: 12 }}>
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
                    (() => {
                      const q = new URLSearchParams({ return_to: afterPayReturnTo });
                      if (embed) q.set("embed", "1");
                      if (paypalReturn) q.set("paypal", paypalReturn);
                      if (paypalOrderId) q.set("token", paypalOrderId);
                      return `/wallet?${q.toString()}`;
                    })(),
                    parentOriginParam,
                  ),
                },
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
        </PlanSheet>
      </main>
    );
  }

  return (
    <main style={pageStyle(embed)}>
      <PlanSheet
        embed={embed}
        closeHref={exitHref}
        title="Add Credits"
        hint="Credits land in this wallet. 100 Credits = $1. PayPal channel fee is extra — not a markup."
      >
        {success ? (
          <p style={{ color: "#7dcea0", fontSize: 13, margin: "0 0 12px" }}>
            {success}
            {!embed ? " Returning to chat…" : ""}
          </p>
        ) : null}
        {error ? (
          <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
        ) : null}

        {!success ? (
          <>
            <p style={{ ...muted, marginBottom: 8 }}>Amount</p>
            <div style={presetRow}>
              {PRESET_AMOUNTS_USD.map((usd) => (
                <button
                  key={usd}
                  type="button"
                  onClick={() => {
                    setSelectedUsd(usd);
                    setCustomUsd("");
                  }}
                  style={{
                    ...presetBtn,
                    borderColor:
                      selectedUsd === usd && !customUsd
                        ? planSheetColors.accent
                        : planSheetColors.border,
                    color:
                      selectedUsd === usd && !customUsd
                        ? planSheetColors.accent
                        : planSheetColors.muted,
                  }}
                >
                  ${usd}
                </button>
              ))}
            </div>
            <label style={{ ...muted, display: "block", margin: "12px 0 6px", fontSize: 12 }}>
              Custom (USD)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={customUsd}
              onChange={(e) => {
                setCustomUsd(e.target.value);
                setSelectedUsd(null);
              }}
              placeholder="10"
              style={inputStyle}
            />
            {faceUsd > 0 ? (
              <div style={totalRow}>
                <span style={{ color: planSheetColors.muted }}>You receive</span>
                <strong>
                  {(quote?.credits ?? faceUsd * CREDITS_PER_USD).toLocaleString()} Credits
                </strong>
              </div>
            ) : null}
            {PAYPAL_CLIENT_ID ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  style={paypalBtnStyle}
                  disabled={paying !== null || faceUsd <= 0}
                  aria-busy={paying === "LOGIN"}
                  onClick={(e) => {
                    e.preventDefault();
                    void startPaypalCheckout("LOGIN");
                  }}
                >
                  {paying === "LOGIN" ? "Redirecting…" : "Pay with PayPal"}
                </button>
                <button
                  type="button"
                  style={cardBtnStyle}
                  disabled={paying !== null || faceUsd <= 0}
                  aria-busy={paying === "BILLING"}
                  onClick={(e) => {
                    e.preventDefault();
                    void startPaypalCheckout("BILLING");
                  }}
                >
                  {paying === "BILLING" ? "Redirecting…" : "Debit or Credit Card"}
                </button>
                {quote ? (
                  <p style={{ ...muted, fontSize: 11 }}>
                    PayPal fee ${quote.channel_fee.toFixed(2)} · you pay $
                    {quote.charge_amount.toFixed(2)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p style={{ color: "#ef4444", fontSize: 13 }}>PayPal is not configured.</p>
            )}
          </>
        ) : null}

        {!embed ? (
          <p style={{ ...muted, marginTop: 16 }}>
            <Link href={afterPayReturnTo} style={linkStyle}>
              Back to Interfaze
            </Link>
          </p>
        ) : null}
      </PlanSheet>
    </main>
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
  background: "#ffc439",
  border: "1px solid #ffc439",
  color: "#003087",
};

const cardBtnStyle: CSSProperties = {
  ...btnStyle,
  marginTop: 0,
  background: "transparent",
  border: `1px solid ${planSheetColors.border}`,
  color: planSheetColors.text,
};

const presetRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const presetBtn: CSSProperties = {
  padding: "10px 0",
  borderRadius: 8,
  border: `1px solid ${planSheetColors.border}`,
  background: planSheetColors.card,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 12,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${planSheetColors.border}`,
  background: planSheetColors.card,
  color: planSheetColors.text,
  fontSize: 13,
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

function WalletAuthGate() {
  if (!isAuth0Configured()) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: planSheetColors.bg,
          color: planSheetColors.text,
          padding: 48,
        }}
      >
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          Auth0 is not configured. Set NEXT_PUBLIC_AUTH0_DOMAIN and NEXT_PUBLIC_AUTH0_CLIENT_ID.
        </p>
        <Link href="/" style={{ color: "#93c5fd", fontSize: 13 }}>
          Back to Interfaze
        </Link>
      </main>
    );
  }
  return <WalletInner />;
}

export default function WalletPage() {
  if (isCnRegion()) {
    return (
      <Suspense
        fallback={
          <main
            style={{
              minHeight: "100vh",
              background: planSheetColors.bg,
              color: planSheetColors.muted,
              padding: 48,
            }}
          >
            加载中…
          </main>
        }
      >
        <CnWalletCheckout />
      </Suspense>
    );
  }
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: planSheetColors.bg,
            color: planSheetColors.muted,
            padding: 48,
          }}
        >
          Loading…
        </main>
      }
    >
      <WalletAuthGate />
    </Suspense>
  );
}
