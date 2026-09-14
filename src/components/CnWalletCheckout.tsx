"use client";

/**
 * CN Interfaze wallet recharge — WeChat Native QR via BFF.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  getCnSessionToken,
  startWeChatLogin,
} from "@/lib/auth/cn";
import {
  notifyWalletCredited,
  resolveEmbedParentOrigin,
} from "@/lib/embedParent";
import { safeReturnTo, walletCheckoutReturnHref } from "@/lib/safeReturnTo";
import { PlanSheet, catalogCloseHref, planSheetColors } from "@/components/PlanCatalog";
import {
  listRechargePackages,
  startWxpayRecharge,
  syncRechargePayment,
  type RechargePackage,
} from "@/lib/api/cnWalletRecharge";

function fmtCredits(n: number): string {
  return Math.trunc(n).toLocaleString();
}

function CnWalletInner() {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const parentOriginParam = resolveEmbedParentOrigin(searchParams.get("parent_origin"));
  const afterPayReturnTo = useMemo(
    () => safeReturnTo(searchParams.get("return_to"), "/?account=wallet"),
    [searchParams],
  );
  const exitHref = catalogCloseHref(searchParams) || afterPayReturnTo;

  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nativeQr, setNativeQr] = useState<string | null>(null);
  const [nativeOrderId, setNativeOrderId] = useState<string | null>(null);

  const selected = packages.find((p) => p.id === selectedId) || null;

  useEffect(() => {
    const syncAuth = () => setAuthed(Boolean(getCnSessionToken()));
    syncAuth();
    setHydrated(true);
    window.addEventListener("storage", syncAuth);
    const onFocus = () => syncAuth();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listRechargePackages("wxpay")
      .then((rows) => {
        if (cancelled) return;
        setPackages(rows);
        setSelectedId((cur) => cur || rows[0]?.id || null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "无法加载充值套餐");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishPaid = useCallback(
    (balance: number) => {
      setNativeQr(null);
      setNativeOrderId(null);
      setSuccess(`已到账，余额 ${fmtCredits(balance)} 星币`);
      notifyWalletCredited(balance, parentOriginParam);
    },
    [parentOriginParam],
  );

  useEffect(() => {
    if (!nativeOrderId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const synced = await syncRechargePayment(nativeOrderId);
        if (!cancelled && synced.paid && synced.balance != null) {
          finishPaid(synced.balance);
        }
      } catch {
        /* notify 入账后下一轮 sync 即可 */
      }
    };
    const id = window.setInterval(tick, 2000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [nativeOrderId, finishPaid]);

  useEffect(() => {
    if (!success || embed) return;
    const href = walletCheckoutReturnHref(afterPayReturnTo);
    const timer = window.setTimeout(() => {
      window.location.replace(href);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [success, embed, afterPayReturnTo]);

  async function startPay() {
    if (!selectedId || paying) return;
    setPaying(true);
    setError(null);
    setNativeQr(null);
    setNativeOrderId(null);
    try {
      const started = await startWxpayRecharge(selectedId);
      if (started.kind === "paid") {
        finishPaid(started.balance);
      } else if (started.kind === "native") {
        setNativeOrderId(started.orderId);
        setNativeQr(started.codeUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建订单失败");
    } finally {
      setPaying(false);
    }
  }

  if (!hydrated) {
    return (
      <main style={pageStyle(embed)}>
        <PlanSheet embed={embed} closeHref={exitHref} title="充值" brand="界面">
          <p style={muted}>加载中…</p>
        </PlanSheet>
      </main>
    );
  }

  if (!authed) {
    return (
      <main style={pageStyle(embed)}>
        <PlanSheet
          embed={embed}
          closeHref={exitHref}
          title="充值"
          brand="界面"
          hint="登录后给钱包充星币。100 星币 = ¥1，通道费另列。"
        >
          <button type="button" style={btnStyle} onClick={() => startWeChatLogin()}>
            微信登录
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
        title="充值星币"
        brand="界面"
        hint="到账 1:1。微信通道费另列，充值不是利润中心。"
      >
        {success ? (
          <p style={{ color: "#7dcea0", fontSize: 13, margin: "0 0 12px" }}>
            {success}
            {!embed ? " 正在返回钱包…" : ""}
          </p>
        ) : null}
        {error ? (
          <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
        ) : null}

        {nativeQr && nativeOrderId ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <p style={{ ...muted, textAlign: "center" }}>
              {selected
                ? `微信支付 ¥${selected.price_yuan} · 到账 ${fmtCredits(selected.credits)} 星币`
                : "请用微信扫码支付"}
            </p>
            <div style={{ background: "#fff", padding: 8, borderRadius: 8 }}>
              <QRCodeSVG value={nativeQr} size={168} marginSize={0} />
            </div>
            <p style={muted}>扫码后此页会自动确认到账</p>
            <button
              type="button"
              style={ghostBtn}
              onClick={() => {
                setNativeQr(null);
                setNativeOrderId(null);
                setError(null);
              }}
            >
              换一套餐
            </button>
          </div>
        ) : !success ? (
          <>
            <p style={{ ...muted, marginBottom: 10 }}>选择金额</p>
            <div style={pkgGrid}>
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedId(pkg.id)}
                  style={{
                    ...pkgBtn,
                    borderColor:
                      selectedId === pkg.id ? planSheetColors.accent : planSheetColors.border,
                    color: selectedId === pkg.id ? planSheetColors.accent : planSheetColors.muted,
                    background:
                      selectedId === pkg.id ? "rgba(59,130,246,0.12)" : planSheetColors.card,
                  }}
                >
                  <span style={{ display: "block", fontWeight: 700, color: planSheetColors.text }}>
                    {pkg.label}
                  </span>
                  <span style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                    ¥{pkg.face_yuan ?? pkg.price_yuan}
                  </span>
                </button>
              ))}
            </div>
            {selected?.fee_yuan != null ? (
              <p style={{ ...muted, fontSize: 11, margin: "8px 0 14px" }}>
                微信通道费 ¥{selected.fee_yuan} · 实付 ¥{selected.price_yuan} · 到账{" "}
                {fmtCredits(selected.credits)} 星币
              </p>
            ) : (
              <p style={{ ...muted, fontSize: 11, margin: "8px 0 14px" }}>
                {selected
                  ? `实付 ¥${selected.price_yuan} · 到账 ${fmtCredits(selected.credits)} 星币`
                  : " "}
              </p>
            )}
            <button
              type="button"
              style={btnStyle}
              disabled={paying || !selected}
              onClick={() => void startPay()}
            >
              {paying
                ? "正在下单…"
                : selected
                  ? `微信支付 ¥${selected.price_yuan}`
                  : "微信支付"}
            </button>
          </>
        ) : null}

        {!embed && success ? (
          <p style={{ ...muted, marginTop: 16 }}>
            <Link href={afterPayReturnTo} style={linkStyle}>
              返回界面
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

const ghostBtn: CSSProperties = {
  ...btnStyle,
  marginTop: 0,
  width: "auto",
  background: "transparent",
  border: `1px solid ${planSheetColors.border}`,
  color: planSheetColors.muted,
};

const pkgGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const pkgBtn: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${planSheetColors.border}`,
  background: planSheetColors.card,
  cursor: "pointer",
  fontSize: 12,
};

export default function CnWalletCheckout() {
  return <CnWalletInner />;
}
