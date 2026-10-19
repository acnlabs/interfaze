const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/ranch-shell/txDisplay.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const api = {};
new Function("exports", "require", js)(api, require);
const { txAmountCaption, txCounterpartyName, txSignedAmounts, txTypeLabel } = api;

const t = {
  walletTxIn: "收入",
  walletTxOut: "支出",
  walletTxTypeRewardGrant: "奖励",
  walletTxTypeWalletTransfer: "转账",
  walletTxTypeRefund: "退款",
  walletTxTypeStorePurchase: "商店购买",
  walletTxTypePlanPurchase: "方案购买",
  walletTxTypeRecharge: "充值",
  walletTxTypeChat: "对话",
  walletTxTypeChatIncome: "对话收入",
  walletTxTypeClawback: "冲回",
  walletTxTypeToAgent: "充给智能体",
  walletTxTypeWithdraw: "提现",
  walletTxTypeComputer: "电脑",
};

test("a balance drop is spent even when the stored amount is positive", () => {
  const mint = {
    transaction_id: "mint",
    type: "clawback",
    amount: 260,
    balance_after: 260,
    description: "Clawback test mint balance (F1/F2 audit)",
    created_at: "2026-10-19T03:00:00Z",
  };
  const back = {
    transaction_id: "back",
    type: "clawback",
    amount: 260,
    balance_after: 0,
    description: "Clawback test mint balance (F1/F2 audit)",
    created_at: "2026-10-19T03:05:00Z",
  };
  const signed = txSignedAmounts([back, mint]);
  assert.equal(signed.get("mint"), 260);
  assert.equal(signed.get("back"), -260);
  assert.equal(txAmountCaption(signed.get("back"), t), "支出 −260");
  assert.equal(txTypeLabel("clawback", t, back.description, signed.get("back")), "冲回");
});

test("ledger titles stay human and hide internal user ids", () => {
  assert.equal(txTypeLabel("service_usage_credit", t, "service_usage_credit:auth0|abc", 12), "对话收入");
  assert.equal(txTypeLabel("refund", t), "退款");
  assert.equal(txCounterpartyName("service_usage_credit:auth0|user_123"), "");
  assert.equal(txCounterpartyName("Topup agent Comiclaw"), "Comiclaw");
});
