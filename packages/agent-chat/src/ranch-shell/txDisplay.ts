import type { RanchMessages } from "./i18n";

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
      return t.walletTxTypeComputer;
    default:
      return type.replace(/_/g, " ");
  }
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
