const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/browserAddress.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { browserAddress } = moduleExports;

test("an https address can open", () => {
  assert.equal(browserAddress("  https://example.com/path  "), "https://example.com/path");
  assert.equal(browserAddress("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
});

test("a command or a bare word stays closed", () => {
  assert.equal(browserAddress("firefox"), null);
  assert.equal(browserAddress("javascript:alert(1)"), null);
  assert.equal(browserAddress("https://example.com/a b"), null);
  assert.equal(browserAddress('https://example.com/"'), null);
  assert.equal(browserAddress("http://"), null);
});
