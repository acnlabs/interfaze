const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/computerManageCta.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { computerManageCta } = moduleExports;

test("an empty list creates the default computer", () => {
  assert.equal(computerManageCta(0), "create");
});

test("a list that already has a computer opens an extra", () => {
  assert.equal(computerManageCta(1), "extra");
  assert.equal(computerManageCta(2), "extra");
});

test("the empty panel does not call the extra button 再开一台", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /computerManageCta/);
  assert.match(panel, /create: "创建云电脑"/);
  assert.match(panel, /hasComputer \? t\.open : t\.create/);
});
