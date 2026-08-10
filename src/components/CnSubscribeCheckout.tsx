"use client";

/**
 * CN Interfaze Plan fiat checkout — WeChat Native QR via BFF.
 */
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  clearCnSession,
  cnDisplayName,
  getCnSessionToken,
  getCnSessionUser,
  startWeChatLogin,
} from "@/lib/auth/cn";
import {
  notifyPlanActivated,
  resolveEmbedParentOrigin,
  withEmbedParentOrigin,
} from "@/lib/embedParent";
import { getAgentPlanetBaseUrl } from "@/lib/region";
import {
  clearPlanCheckoutStash,
  getPendingPlanCheckout,
  getWxplanOrderId,
  parsePlanCheckoutGate,
  resolvePlanSyncOrderId,
  stashPlanCheckout,
  startPlanNativeCheckout,
  syncPlanCheckoutPayment,
} from "@/lib/api/cnPlanCheckout";

const PLAN_CNY: Record<string, { label: string; amountYuan: number }> = {
  pro: { label: "界面 Pro", amountYuan: 58 },
  max: { label: "界面 Max", amountYuan: 498 },
};

function normalizePlan(raw: string | null | undefined): string {
  const c = (raw || "").trim().toLowerCase();
  return c === "ultra" ? "max" : c;
}

function CnSubscribeInner() {
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const urlPlan = normalizePlan(searchParams.get("plan"));
  const initialRenew =
    searchParams.get("renew") === "1" || searchParams.get("renew") === "true";
  const embed = searchParams.get("embed") === "1";
  const parentOriginParam = resolveEmbedParentOrigin(searchParams.get("parent_origin"));
  const notifyParent = useCallback(
    (plan: string, paidUntil?: string | null) => {
      notifyPlanActivated(plan, paidUntil, parentOriginParam);
    },
    [parentOriginParam],
  );

  const [planCode, setPlanCode] = useState<string | null>(
    urlPlan && PLAN_CNY[urlPlan] ? urlPlan : null,
  );
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nativeQr, setNativeQr] = useState<string | null>(null);
  const [nativeOrderId, setNativeOrderId] = useState<string | null>(null);
  const [renew, setRenew] = useState(initialRenew);
  const [needsRenewConfirm, setNeedsRenewConfirm] = useState(false);

  useEffect(() => {
    const syncAuth = () => setAuthed(Boolean(getCnSessionToken()));
    syncAuth();
    setHydrated(true);
    // OAuth may finish in a popup/new tab (embed) — same-origin storage event.
    window.addEventListener("storage", syncAuth);
    const onFocus = () => syncAuth();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const code = normalizePlan(searchParams.get("plan"));
    if (code && PLAN_CNY[code]) {
      const pending = getPendingPlanCheckout(searchParams);
      if (pending?.planCode && pending.planCode !== code) clearPlanCheckoutStash();
      setPlanCode(code);
      setRenew(
        searchParams.get("renew") === "1" || searchParams.get("renew") === "true",
      );
      setNeedsRenewConfirm(false);
      setError(null);
      setSuccess(null);
      setNativeQr(null);
      setNativeOrderId(null);
    }
  }, [searchParams]);

  // Return sync
  useEffect(() => {
    if (!hydrated || !authed) return;
    const urlCode = normalizePlan(searchParams.get("plan"));
    const wxplan = getWxplanOrderId(searchParams);
    const pending = urlCode
      ? getPendingPlanCheckout(searchParams, urlCode)
      : getPendingPlanCheckout(searchParams);
    const code = pending?.planCode || urlCode;
    if (code && PLAN_CNY[code]) setPlanCode(code);
    const hasMiniReturn = Boolean(wxplan && urlCode && PLAN_CNY[urlCode]);
    if (!hasMiniReturn && !pending?.orderId) return;
    if (!code || !PLAN_CNY[code]) return;

    let cancelled = false;
    void (async () => {
      setPaying(true);
      setError(null);
      try {
        const preferred = hasMiniReturn ? wxplan : pending?.orderId;
        const orderId = await resolvePlanSyncOrderId(code, preferred);
        const synced = await syncPlanCheckoutPayment(orderId);
        if (cancelled) return;
        if (synced.plan_code) stashPlanCheckout(orderId, synced.plan_code);
        if (synced.status === "plan_activated") {
          clearPlanCheckoutStash();
          setSuccess(
            `${(synced.plan_code || code).toUpperCase()} 已开通` +
              (synced.paid_until
                ? `，有效至 ${new Date(synced.paid_until).toLocaleDateString()}`
                : ""),
          );
          notifyParent(synced.plan_code || code, synced.paid_until);
        } else if (!synced.paid) {
          setError("尚未检测到付款，请支付后点「我已完成支付」；勿重复下单");
        } else {
          setError("已收到付款，开通处理中，请再点一次「我已完成支付」");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "查询失败，请稍后重试");
      } finally {
        if (!cancelled) setPaying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, authed, searchParams]);

  // Poll Native QR
  useEffect(() => {
    if (!nativeOrderId || success) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const synced = await syncPlanCheckoutPayment(nativeOrderId);
        if (cancelled) return;
        if (synced.status === "plan_activated") {
          clearPlanCheckoutStash();
          setNativeQr(null);
          setSuccess(
            `${(synced.plan_code || planCode || "plan").toUpperCase()} 已开通` +
              (synced.paid_until
                ? `，有效至 ${new Date(synced.paid_until).toLocaleDateString()}`
                : ""),
          );
          setError(null);
          notifyParent(synced.plan_code || planCode || "plan", synced.paid_until);
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [nativeOrderId, success, planCode]);

  const startPay = useCallback(
    async (opts?: { renew?: boolean }) => {
      if (!planCode || paying) return;
      const renewFlag = opts?.renew ?? renew;
      if (opts?.renew) setRenew(true);
      setPaying(true);
      setError(null);
      setSuccess(null);
      setNeedsRenewConfirm(false);
      try {
        const pending = getPendingPlanCheckout(searchParams, planCode);
        const started = await startPlanNativeCheckout(planCode, pending?.orderId || null, {
          renew: renewFlag,
        });
        setNativeQr(started.codeUrl);
        setNativeOrderId(started.orderId);
      } catch (err) {
        const gate = parsePlanCheckoutGate(err);
        if (gate?.code === "already_paid" && gate.orderId) {
          setError(gate.message);
          setNativeOrderId(gate.orderId);
          try {
            const synced = await syncPlanCheckoutPayment(gate.orderId);
            if (synced.status === "plan_activated") {
              clearPlanCheckoutStash();
              setNativeQr(null);
              setSuccess(
                `${(synced.plan_code || planCode).toUpperCase()} 已开通` +
                  (synced.paid_until
                    ? `，有效至 ${new Date(synced.paid_until).toLocaleDateString()}`
                    : ""),
              );
              setError(null);
              notifyParent(synced.plan_code || planCode, synced.paid_until);
            } else {
              setError(gate.message + "（可点下方「我已完成支付」）");
            }
          } catch {
            setError(gate.message + "（可点下方「我已完成支付」）");
          }
        } else if (gate?.code === "already_active") {
          setNeedsRenewConfirm(true);
          setError(
            gate.message +
              (gate.paidUntil
                ? `（有效至 ${new Date(gate.paidUntil).toLocaleDateString()}）`
                : ""),
          );
        } else {
          setError(gate?.message || (err instanceof Error ? err.message : "下单失败"));
        }
      } finally {
        setPaying(false);
      }
    },
    [planCode, paying, renew, searchParams, notifyParent],
  );

  const plan = planCode ? PLAN_CNY[planCode] : null;
  const user = getCnSessionUser();

  if (!plan || !planCode) {
    return (
      <main style={pageStyle(embed)}>
        {!embed ? <Header /> : null}
        <div style={cardStyle}>
          <h1 style={titleStyle}>界面订阅</h1>
          <p style={muted}>请从账户「方案与用量」选择 Pro / Max。</p>
          {!embed ? (
            <Link href="/" style={linkStyle}>
              返回界面
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main style={pageStyle(embed)}>
        <p style={{ ...muted, padding: 48, textAlign: "center" }}>加载中…</p>
      </main>
    );
  }

  if (!authed) {
    const returnTo = withEmbedParentOrigin(
      `/subscribe?plan=${planCode}${renew ? "&renew=1" : ""}${embed ? "&embed=1" : ""}`,
      parentOriginParam,
    );
    return (
      <main style={pageStyle(embed)}>
        {!embed ? <Header /> : null}
        <div style={cardStyle}>
          <h1 style={titleStyle}>订阅 {plan.label}</h1>
          <p style={muted}>
            微信支付 ¥{plan.amountYuan} / 30 天。不扣钱包星币。
          </p>
          {embed ? (
            <p style={{ ...muted, marginBottom: 8, fontSize: 12 }}>
              将在新窗口完成微信登录；登录成功后请回到此页继续支付。
            </p>
          ) : null}
          <button type="button" style={btnStyle} onClick={() => startWeChatLogin(returnTo)}>
            微信登录
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle(embed)}>
      {!embed ? <Header /> : null}
      <div style={cardStyle}>
        <p
          style={{
            ...muted,
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          界面 · {user ? cnDisplayName(user) : "已登录"}
        </p>
        <h1 style={titleStyle}>订阅 {plan.label}</h1>
        <p style={muted}>
          扫码支付 ¥{plan.amountYuan}，开通 30 天。不扣钱包星币。
          {renew ? " 续费将在当前有效期上再叠加 30 天。" : ""}
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
          <span style={{ color: "#6b7280" }}>合计</span>
          <strong>¥{plan.amountYuan}</strong>
        </div>
        {success ? <p style={{ color: "#10b981", fontSize: 13 }}>{success}</p> : null}
        {error ? <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p> : null}
        {needsRenewConfirm ? (
          <button
            type="button"
            style={btnStyle}
            disabled={paying}
            onClick={() => {
              setNeedsRenewConfirm(false);
              void startPay({ renew: true });
            }}
          >
            确认续费
          </button>
        ) : null}
        {!success && !nativeQr && !needsRenewConfirm ? (
          <button type="button" style={btnStyle} disabled={paying} onClick={() => void startPay()}>
            {paying ? "处理中…" : "微信支付"}
          </button>
        ) : null}
        {nativeQr ? (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div
              style={{
                display: "inline-block",
                padding: 12,
                background: "#fff",
                borderRadius: 8,
              }}
            >
              <QRCodeSVG value={nativeQr} size={180} marginSize={0} />
            </div>
            <p style={{ ...muted, marginTop: 10 }}>请使用微信扫码支付</p>
            <p style={{ ...muted, marginTop: 6, fontSize: 12 }}>
              付款成功后一般会自动开通；若页面没变化，再点下方按钮。
            </p>
            <button
              type="button"
              style={{ ...btnStyle, marginTop: 8, background: "#333", color: "#fff" }}
              disabled={paying || !nativeOrderId}
              onClick={() => {
                if (!nativeOrderId) return;
                void (async () => {
                  setPaying(true);
                  try {
                    const synced = await syncPlanCheckoutPayment(nativeOrderId);
                    if (synced.status === "plan_activated") {
                      clearPlanCheckoutStash();
                      setNativeQr(null);
                      setSuccess(
                        `${(synced.plan_code || planCode).toUpperCase()} 已开通` +
                          (synced.paid_until
                            ? `，有效至 ${new Date(synced.paid_until).toLocaleDateString()}`
                            : ""),
                      );
                      notifyParent(synced.plan_code || planCode, synced.paid_until);
                    } else {
                      setError("还没查到付款，请确认微信已支付后再试");
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "查询失败，请稍后重试");
                  } finally {
                    setPaying(false);
                  }
                })();
              }}
            >
              我已完成支付
            </button>
          </div>
        ) : null}
        {!embed ? (
          <p style={{ ...muted, marginTop: 20 }}>
            需要充值星币？{" "}
            <a href={`${getAgentPlanetBaseUrl()}/wallet?recharge=1`} style={linkStyle}>
              打开钱包
            </a>
            {" · "}
            <button
              type="button"
              style={{ ...linkStyle, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              onClick={() => {
                clearCnSession();
                setAuthed(false);
              }}
            >
              退出登录
            </button>
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 24 }}>
      <Link href="/" style={{ ...linkStyle, fontSize: 14, fontWeight: 600 }}>
        界面
      </Link>
    </div>
  );
}

export default function CnSubscribeCheckout() {
  return (
    <Suspense
      fallback={
        <main style={pageStyle(false)}>
          <p style={{ ...muted, padding: 48, textAlign: "center" }}>加载中…</p>
        </main>
      }
    >
      <CnSubscribeInner />
    </Suspense>
  );
}

function pageStyle(embed: boolean): CSSProperties {
  return {
    minHeight: embed ? "100%" : "100vh",
    padding: embed ? "16px" : "48px 24px",
    background: embed
      ? "transparent"
      : "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(34,211,238,0.12), transparent 55%), var(--bg)",
    color: "var(--fg)",
  };
}

const cardStyle: CSSProperties = {
  maxWidth: 420,
  margin: "0 auto",
  padding: "28px 24px",
  border: "1px solid #1f1f1f",
  background: "#0a0a0a",
};

const titleStyle: CSSProperties = { fontSize: 22, fontWeight: 700, margin: "0 0 8px" };
const muted: CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: 1.5, margin: 0 };
const linkStyle: CSSProperties = { color: "var(--accent)", textDecoration: "none" };
const btnStyle: CSSProperties = {
  marginTop: 8,
  width: "100%",
  border: "none",
  borderRadius: 999,
  background: "var(--accent)",
  color: "#052e1f",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 22px",
  cursor: "pointer",
};
