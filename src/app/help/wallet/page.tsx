import Link from "next/link";
import type { CSSProperties } from "react";
import { PlanSheet, planSheetColors } from "@/components/PlanCatalog";
import { isCnRegion } from "@/lib/region";

const muted: CSSProperties = {
  color: planSheetColors.muted,
  fontSize: 13,
  lineHeight: 1.55,
  margin: "0 0 12px",
};

const h2: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  margin: "20px 0 8px",
  color: planSheetColors.text,
};

const linkStyle: CSSProperties = {
  color: "var(--info)",
  textDecoration: "none",
};

function GlobalWalletHelp() {
  return (
    <PlanSheet
      embed={false}
      closeHref="/"
      title="Credits & PayPal"
      hint="Adding Credits to your wallet"
    >
      <h2 style={h2}>Credits</h2>
      <p style={muted}>
        Your <strong>Credits</strong> balance pays for billable usage while you are signed in.
        When you add Credits, <strong>100 Credits = $1</strong> face value in USD.
      </p>

      <h2 style={h2}>Checkout</h2>
      <p style={muted}>
        Payment is processed by <strong>PayPal</strong> — either with a PayPal account or with a
        debit/credit card on PayPal&apos;s checkout page. A PayPal channel fee is added on top of
        the face amount (shown before you pay). It is not an Interfaze markup.
      </p>

      <h2 style={h2}>If payment is declined</h2>
      <p style={muted}>
        Declines and compliance messages come from <strong>PayPal</strong> or your card issuer.
        Interfaze only creates the order; we cannot override PayPal&apos;s decision or see the full
        reason.
      </p>
      <p style={muted}>
        You can try another PayPal account or card, finish PayPal account verification, or contact
        PayPal with the reference shown on their page. Avoid many retries in a short time.
      </p>
      <p style={muted}>
        <Link href="/wallet" style={linkStyle}>
          Back to Add Credits
        </Link>
      </p>
    </PlanSheet>
  );
}

function CnWalletHelp() {
  return (
    <PlanSheet embed={false} closeHref="/" title="星币与微信支付" brand="界面" hint="钱包充值说明">
      <h2 style={h2}>星币</h2>
      <p style={muted}>
        <strong>星币</strong>用于登录账户下的可计费使用。<strong>100 星币 = ¥1</strong> 面额，到账
        1:1。
      </p>

      <h2 style={h2}>充值</h2>
      <p style={muted}>
        通过微信支付完成。通道费在下单前单独列出，不是平台加价；充值本身不是利润中心。
      </p>
      <p style={muted}>扫码支付后，本页会自动确认到账。可在钱包查看余额与最近流水。</p>

      <h2 style={h2}>若支付失败</h2>
      <p style={muted}>多为微信或银行侧限制。请稍后重试或更换支付方式，避免短时间内频繁重试。</p>
      <p style={muted}>
        <Link href="/wallet" style={linkStyle}>
          返回充值
        </Link>
      </p>
    </PlanSheet>
  );
}

export default function WalletHelpPage() {
  const cn = isCnRegion();
  return (
    <main
      style={{
        minHeight: "100vh",
        background: planSheetColors.bg,
        color: planSheetColors.text,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      {cn ? <CnWalletHelp /> : <GlobalWalletHelp />}
    </main>
  );
}
