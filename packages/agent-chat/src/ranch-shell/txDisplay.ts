import { computerName } from "../computerLabel";
import type { RanchMessages } from "./i18n";

export type TxSubject = {
  kind?: string | null;
  title?: string | null;
  is_default?: boolean;
  extra_index?: number;
};

/** Human-readable label for a ledger transaction type. */
export function txTypeLabel(
  type: string,
  t: RanchMessages,
  description?: string | null,
): string {
  const text = description || "";
  switch (type) {
    case "reward_grant":
      return t.walletTxTypeRewardGrant;
    case "wallet_transfer":
      if (/Withdraw from agent\b/i.test(text)) return t.walletTxTypeWithdraw;
      if (/Topup agent\b/i.test(text)) return t.walletTxTypeToAgent;
      return t.walletTxTypeWalletTransfer;
    case "refund":
      if (/cloud computer/i.test(text)) return t.walletTxTypeComputerRefund;
      return t.walletTxTypeRefund;
    case "store_purchase":
      return t.walletTxTypeStorePurchase;
    case "plan_purchase":
      return t.walletTxTypePlanPurchase;
    case "recharge":
      return t.walletTxTypeRecharge;
    case "service_usage":
    case "agent_receive":
      return t.walletTxTypeChat;
    case "computer_usage":
    case "extra_computer":
      if (/paused disk/i.test(text)) return t.walletTxTypeComputerPause;
      return t.walletTxTypeComputer;
    default:
      return type.replace(/_/g, " ");
  }
}

/** Chat title, or the computer's own name. Empty when the row has neither. */
export function txSubjectLabel(
  subject: TxSubject | null | undefined,
  t: RanchMessages,
  locale: "en" | "zh",
): string {
  if (!subject) return "";
  if (subject.kind === "chat") {
    const title = (subject.title || "").trim();
    return title || t.untitledChat;
  }
  if (subject.kind === "computer") {
    return computerName(!!subject.is_default, subject.extra_index ?? 0, locale);
  }
  return "";
}

export function txDetailLine(
  subject: TxSubject | null | undefined,
  createdAt: string | null | undefined,
  t: RanchMessages,
  locale: "en" | "zh",
): string {
  const name = txSubjectLabel(subject, t, locale);
  const when = fmtTxTimeShort(createdAt);
  return [name, when].filter(Boolean).join(" · ");
}

/** Compact timestamp for ledger rows, e.g. "8/27, 11:12 PM" / "8/27 23:12". */
export function fmtTxTimeShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
