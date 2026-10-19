import type { RanchMessages } from "./i18n";

export type LedgerTx = {
  transaction_id?: string;
  type: string;
  amount: number;
  balance_after?: number | null;
  direction?: string | null;
  description?: string | null;
  created_at?: string | null;
};

/** Signed credits for one row. A balance drop wins over a positive stored amount. */
export function txSignedAmount(tx: LedgerTx, olderBalance: number | null): number {
  const amount = Number(tx.amount);
  if (
    typeof tx.balance_after === "number" &&
    olderBalance != null &&
    Number.isFinite(tx.balance_after) &&
    Number.isFinite(olderBalance)
  ) {
    const delta = tx.balance_after - olderBalance;
    if (delta !== 0) return delta;
  }
  if (!Number.isFinite(amount)) return 0;
  if (tx.direction === "out") return -Math.abs(amount);
  if (tx.direction === "in") return Math.abs(amount);
  const type = (tx.type || "").toLowerCase();
  if (
    type === "service_usage" ||
    type === "store_purchase" ||
    type === "plan_purchase" ||
    type === "computer_usage"
  ) {
    return -Math.abs(amount);
  }
  return amount;
}

/** Newest-or-oldest lists both work: pair each row with the balance before it. */
export function txSignedAmounts<T extends LedgerTx>(txs: T[]): Map<string, number> {
  const sorted = [...txs].sort((a, b) => {
    const ta = Date.parse(a.created_at || "") || 0;
    const tb = Date.parse(b.created_at || "") || 0;
    return ta - tb;
  });
  const out = new Map<string, number>();
  let older: number | null = null;
  for (const tx of sorted) {
    const signed = txSignedAmount(tx, older);
    if (tx.transaction_id) out.set(tx.transaction_id, signed);
    if (typeof tx.balance_after === "number" && Number.isFinite(tx.balance_after)) {
      older = tx.balance_after;
    }
  }
  return out;
}

/** Human-readable label for a ledger transaction type. */
export function txTypeLabel(
  type: string,
  t: RanchMessages,
  description?: string | null,
  signedAmount?: number,
): string {
  const text = description || "";
  const key = (type || "").toLowerCase();
  const inbound = (signedAmount ?? 0) > 0;
  if (key.includes("clawback") || /\bclawback\b/i.test(text)) return t.walletTxTypeClawback;
  switch (key) {
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
      return inbound ? t.walletTxTypeChatIncome : t.walletTxTypeChat;
    case "service_usage_credit":
    case "agent_receive":
      return t.walletTxTypeChatIncome;
    case "computer_usage":
      return t.walletTxTypeComputer;
    default:
      if (key.includes("refund")) return t.walletTxTypeRefund;
      if (key.includes("service_usage")) return inbound ? t.walletTxTypeChatIncome : t.walletTxTypeChat;
      return t.walletTxTypeWalletTransfer;
  }
}

/** "收入 +260" / "支出 −260". The minus is the caption, not a second sign on the number. */
export function txAmountCaption(signed: number, t: RanchMessages): string {
  const abs = Math.abs(Math.trunc(signed)).toLocaleString();
  if (signed > 0) return `${t.walletTxIn} +${abs}`;
  if (signed < 0) return `${t.walletTxOut} −${abs}`;
  return abs;
}

/** A person's name, when the ledger text has one. Internal ids never count. */
export function txCounterpartyName(desc: string | null | undefined): string {
  if (!desc) return "";
  const named =
    desc.match(/\b(?:from|to)\s+agent\s+([^:|]{1,40})/i) ||
    desc.match(/\bagent\s+([^:|]{1,40})/i);
  const raw = (named?.[1] || "").trim();
  if (!raw || /auth0\||service_usage|clawback|audit/i.test(raw)) return "";
  return raw.replace(/\s{2,}/g, " ");
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
