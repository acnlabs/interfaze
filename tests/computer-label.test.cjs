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
const { chatComputerLabel, computerName, extraIndex } = moduleExports;

test("the default computer and later computers have stable names", () => {
  assert.equal(computerName(true, 0, "zh"), "默认电脑");
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
  assert.equal(chatComputerLabel("cloud", true, extraIndex(rows, "default"), "zh"), "默认电脑");
  assert.equal(chatComputerLabel("cloud", false, extraIndex(rows, "extra-b"), "zh"), "电脑 3");
});
