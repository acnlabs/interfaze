const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/computerLabel.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { chatComputerLabel, computerName, computerOpenCost, extraIndex } = moduleExports;

test("opening another computer uses Credits overseas and 星币 in China", () => {
  const prev = process.env.NEXT_PUBLIC_REGION;
  delete process.env.NEXT_PUBLIC_REGION;
  try {
    const overseas = computerOpenCost("zh");
    assert.equal(overseas.hint.includes("100 Credit = 1 美元"), true);
    assert.equal(overseas.hint.includes("积分"), false);
    assert.equal(overseas.hint.includes("星币"), false);
    assert.equal(computerOpenCost("en").hint.includes("100 Credits = 1 USD"), true);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_REGION;
    else process.env.NEXT_PUBLIC_REGION = prev;
  }
  process.env.NEXT_PUBLIC_REGION = "cn";
  try {
    const cn = computerOpenCost("zh");
    assert.equal(cn.hint.includes("100 星币 = 1 美元"), true);
    assert.equal(cn.short, "星币不够，没有新开电脑。");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_REGION;
    else process.env.NEXT_PUBLIC_REGION = prev;
  }
});

test("the default computer and later computers have stable names", () => {
  assert.equal(computerName(true, 0, "zh"), "电脑");
  assert.equal(computerName(true, 0, "en"), "Computer");
  assert.equal(computerName(false, 0, "zh"), "电脑 2");
  assert.equal(computerName(false, 1, "en"), "Computer 3");
});

test("a chat label follows the computer it is bound to", () => {
  const rows = [
    { computer_id: "default", is_default: true },
    { computer_id: "extra-a", is_default: false },
    { computer_id: "extra-b", is_default: false },
  ];
  assert.equal(chatComputerLabel("agent", null, 0, "zh"), "Agent 的机器");
  assert.equal(chatComputerLabel("cloud", true, extraIndex(rows, "default"), "zh"), "电脑");
  assert.equal(chatComputerLabel("cloud", true, extraIndex(rows, "default"), "en"), "Computer");
  assert.equal(chatComputerLabel("cloud", false, extraIndex(rows, "extra-b"), "zh"), "电脑 3");
});
