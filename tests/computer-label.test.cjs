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
const { chatComputerLabel, computerName, computerRunStatus, computerStatusWord, extraIndex } = moduleExports;

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

test("cloud computer status words stay on the three known states", () => {
  assert.equal(computerRunStatus("running"), "running");
  assert.equal(computerRunStatus("paused"), "paused");
  assert.equal(computerRunStatus("idle"), "idle");
  assert.equal(computerRunStatus(null), null);
  assert.equal(computerRunStatus("starting"), null);
  assert.equal(computerStatusWord("running", "zh"), "开着");
  assert.equal(computerStatusWord("paused", "zh"), "暂停");
  assert.equal(computerStatusWord("idle", "en"), "Idle");
  assert.equal(computerStatusWord("starting", "en"), null);
});
