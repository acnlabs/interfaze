const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTs(rel) {
  const source = fs.readFileSync(path.join(__dirname, rel), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const moduleExports = {};
  const localRequire = (id) => {
    if (id.includes("computerLabel")) return loadTs("../packages/agent-chat/src/computerLabel.ts");
    return require(id);
  };
  new Function("exports", "require", js)(moduleExports, localRequire);
  return moduleExports;
}

const { txTypeLabel, txDetailLine } = loadTs("../packages/agent-chat/src/ranch-shell/txDisplay.ts");

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
  walletTxTypeComputerPause: "电脑暂停",
  walletTxTypeComputerRefund: "电脑退回",
  untitledChat: "未命名对话",
};

test("a computer pause and a prepaid return are not a generic 电脑", () => {
  assert.equal(txTypeLabel("computer_usage", t, "cloud computer running time"), "电脑");
  assert.equal(txTypeLabel("computer_usage", t, "cloud computer paused disk"), "电脑暂停");
  assert.equal(txTypeLabel("refund", t, "cloud computer running time returned"), "电脑退回");
  assert.equal(txTypeLabel("refund", t, "plan unused"), "退款");
  assert.equal(txTypeLabel("extra_computer", t), "电脑");
});

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

test("the line under the name says which chat or computer", () => {
  const chat = txDetailLine({ kind: "chat", title: "周报" }, "2026-10-05T11:25:00Z", t, "zh");
  assert.equal(chat.startsWith("周报 · "), true);
  const untitled = txDetailLine({ kind: "chat", title: "  " }, "2026-10-05T11:25:00Z", t, "zh");
  assert.equal(untitled.startsWith("未命名对话 · "), true);
  const extra = txDetailLine(
    { kind: "computer", is_default: false, extra_index: 0 },
    "2026-10-08T07:46:00Z",
    t,
    "zh",
  );
  assert.equal(extra.startsWith("电脑 2 · "), true);
});
