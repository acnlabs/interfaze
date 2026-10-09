const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/ranch-shell/accountDeepLink.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { readAccountPanelFromUrl } = moduleExports;

test("account=computer opens the computer panel", () => {
  assert.equal(readAccountPanelFromUrl("?account=computer"), "computer");
  assert.equal(readAccountPanelFromUrl("?account=wallet"), "wallet");
  assert.equal(readAccountPanelFromUrl("?account=nope"), null);
});
