const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const moduleExports = {};
  new Function("exports", js)(moduleExports);
  return moduleExports;
}

const { ranchMessages } = load();

test("overseas Chinese wallet says Credit, not 星币", () => {
  const prev = process.env.NEXT_PUBLIC_REGION;
  delete process.env.NEXT_PUBLIC_REGION;
  try {
    const t = ranchMessages("zh");
    assert.equal(
      t.walletCreditsHint,
      "用来付费的余额。100 Credit = 1 美元。充值和提取只动 Credit。AP 积分是奖励，不能转出。",
    );
    assert.equal(t.walletBalance, "Credit");
    assert.equal(t.walletAmountHint, "整数 Credit。100 Credit = 1 美元。");
    assert.equal(t.walletCreditsHint.includes("星币"), false);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_REGION;
    else process.env.NEXT_PUBLIC_REGION = prev;
  }
});

test("China-region Chinese wallet keeps 星币", () => {
  const prev = process.env.NEXT_PUBLIC_REGION;
  process.env.NEXT_PUBLIC_REGION = "cn";
  try {
    const t = ranchMessages("zh");
    assert.equal(t.walletBalance, "星币");
    assert.equal(t.walletCreditsHint.includes("100 星币 = 1 美元"), true);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_REGION;
    else process.env.NEXT_PUBLIC_REGION = prev;
  }
});

test("English wallet stays Credits", () => {
  const t = ranchMessages("en");
  assert.equal(t.walletCreditsHint.includes("100 Credits = 1 USD"), true);
  assert.equal(t.walletBalance, "Credits");
});
