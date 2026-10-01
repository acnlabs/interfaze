import type { RanchMessages } from "./i18n";

/** Human-readable label for a ledger transaction type. */
export function txTypeLabel(type: string, t: RanchMessages): string {
  switch (type) {
    case "reward_grant":
      return t.walletTxTypeRewardGrant;
    case "wallet_transfer":
      return t.walletTxTypeWalletTransfer;
    case "refund":
      return t.walletTxTypeRefund;
    case "store_purchase":
      return t.walletTxTypeStorePurchase;
    case "plan_purchase":
      return t.walletTxTypePlanPurchase;
    case "recharge":
      return t.walletTxTypeRecharge;
    default:
      return type.replace(/_/g, " ");
  }
}

/** Ledger descriptions embed raw order/agent UUIDs — strip them for display. */
export function cleanTxDescription(desc: string | null | undefined): string {
  if (!desc) return "";
  return desc
    .replace(/order=[0-9a-f-]{36}/gi, "")
    .replace(/\b[\w-]*recharge:[^\s]+/gi, "")
    .replace(/\bcampaign_vault:\S*/gi, "")
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[·:\s]+/, "")
    .replace(/\s*([·:])\s*$/, "")
    .trim();
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
