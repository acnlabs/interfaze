const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { ranchMessages } = moduleExports;

function stringsWith(messages, pattern) {
  const hits = [];
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === "string" && pattern.test(value)) hits.push(key);
  }
  return hits;
}

test("China Chinese names the unit 星币, not the English word Credits", () => {
  const zh = ranchMessages("zh", true);
  assert.deepEqual(stringsWith(zh, /Credits/), []);
  assert.equal(zh.accountWalletHint, "你本人的星币余额。智能体钱包在各自智能体详情里。");
  assert.equal(zh.walletInsufficient, "星币不足，无法完成本次转账。");
  assert.equal(zh.myAgentsPieceSkuLabel, "单文件封顶（星币）");
  assert.equal(zh.myAgentsPieceSkuFillCredits, "填星币");
  assert.match(zh.spendPolicyHint, /星币/);
  assert.match(zh.myAgentsAllowlistHint, /免扣星币/);
  assert.equal(zh.pieceHeld(3), "按件结算中 3 星币");
  assert.equal(zh.spendApprovalAmount, "{n} 星币");
  assert.equal(zh.pieceListed(12), "12 星币");
  assert.equal(zh.walletAmountHintCn, "整数星币。100 星币 = 1 元人民币。");
});

test("overseas Chinese names the unit credit, and does not say 星币", () => {
  const zh = ranchMessages("zh-CN", false);
  assert.deepEqual(stringsWith(zh, /Credits/), []);
  assert.deepEqual(
    stringsWith(zh, /星币/).filter((key) => key !== "walletAmountHintCn"),
    [],
  );
  assert.equal(zh.accountWalletHint, "你本人的 credit 余额。智能体钱包在各自智能体详情里。");
  assert.equal(zh.walletInsufficient, "credit 不足，无法完成本次转账。");
  assert.equal(zh.myAgentsPieceSkuLabel, "单文件封顶（credit）");
  assert.equal(zh.myAgentsPieceSkuLabelImage, "每张图 credits（猎人一口价）");
  assert.equal(zh.myAgentsPieceSkuFillCredits, "填 credit");
  assert.equal(zh.myAgentsPieceSkuMeterNumeric, "你自己填每件 credit");
  assert.match(zh.spendPolicyHint, /多少 credit/);
  assert.match(zh.spendPolicyHint, /自主 credit 流出/);
  assert.equal(zh.spendPolicyInvalidLimits, "请填写非负整数 credit，某项留空表示不限。");
  assert.match(zh.spendAutonomyUnlimitedWarn, /花光其 credit/);
  assert.equal(zh.spendReserveFloorHint, "自主消费不得使 credit 低于此值。");
  assert.match(zh.spendApprovalsHint, /从 credit 扣款/);
  assert.equal(zh.spendApprovalAmount, "{n} credits");
  assert.match(zh.myAgentsPolicyAllowlistHelp, /免扣 credit/);
  assert.match(zh.myAgentsAllowlistHint, /免扣 credit/);
  assert.equal(zh.pieceHeld(3), "按件结算中 3 credits");
  assert.equal(zh.pieceListed(12), "12 credits");
  assert.equal(zh.walletAmountHintCn, "整数星币。100 星币 = 1 元人民币。");
});

test("English keeps Credits on both sites", () => {
  const china = ranchMessages("en", true);
  const overseas = ranchMessages("en", false);
  assert.equal(china.pieceListed(12), "12 Credits");
  assert.equal(china.spendApprovalAmount, "{n} Credits");
  assert.equal(overseas.spendApprovalAmount, "{n} Credits");
  assert.equal(overseas.pieceListed(12), "12 Credits");
  assert.equal(china.pieceHeld(3), "3 Credits settling");
  assert.equal(china.accountWalletHint, overseas.accountWalletHint);
});

test("chat attachments use the same unit sentence", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const assistant = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/AgentChatShell.tsx"),
    "utf8",
  );
  const wallet = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/AgentOwnerWallet.tsx"),
    "utf8",
  );
  assert.match(wallet, /t\.spendApprovalAmount\.replace\("\{n\}", fmtCredits\(r\.amount\)\)/);
  assert.doesNotMatch(wallet, /fmtCredits\(r\.amount\)\} Credits/);
  assert.match(shell, /listedPriceLabel=\{t\.pieceListed\}/);
  assert.match(assistant, /listedPriceLabel=\{listedPriceLabel\}/);
  assert.match(
    assistant,
    /ranchMessages\(\s*isAssistant \? "zh" : "en",\s*isCnInterfazeOrigin\(resolveInterfazeOrigin\(\)\)/,
  );
});
