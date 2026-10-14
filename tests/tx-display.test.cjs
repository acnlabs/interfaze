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
const moduleExports = {};
new Function("exports", "require", js)(moduleExports, require);
const { txTypeLabel } = moduleExports;

const t = {
  walletTxTypeRewardGrant: "奖励",
  walletTxTypeWalletTransfer: "转账",
  walletTxTypeRefund: "退款",
  walletTxTypeStorePurchase: "商店购买",
  walletTxTypePlanPurchase: "买方案",
  walletTxTypeRecharge: "充值",
  walletTxTypeChat: "对话",
  walletTxTypeToAgent: "充给智能体",
  walletTxTypeWithdraw: "提现",
  walletTxTypeComputer: "电脑",
};

test("a chat charge and a chat earning share the chat name", () => {
  assert.equal(txTypeLabel("service_usage", t), "对话");
  assert.equal(txTypeLabel("agent_receive", t), "对话");
  assert.equal(txTypeLabel("plan_purchase", t), "买方案");
  assert.equal(txTypeLabel("recharge", t), "充值");
});

test("a transfer name follows top-up or withdraw", () => {
  assert.equal(txTypeLabel("wallet_transfer", t, "Topup agent agent-1"), "充给智能体");
  assert.equal(txTypeLabel("wallet_transfer", t, "Withdraw from agent agent-1"), "提现");
  assert.equal(txTypeLabel("wallet_transfer", t, "something else"), "转账");
});
