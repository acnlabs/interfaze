const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const file = path.join(
  __dirname,
  "../packages/agent-chat/src/ranch-shell/settleQuote.ts",
);
const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { chatSettleQuote } = moduleExports;

test("byo hunter price grosses the fee outside the marked-up book", () => {
  const quote = chatSettleQuote(1, 2, 50, false, 0.1);
  assert.equal(quote.ownerIn, 1.5);
  assert.equal(quote.ownerOut, 3);
  assert.ok(Math.abs(quote.hunterIn - 1.5 / 0.9) < 1e-6);
  assert.ok(Math.abs(quote.hunterOut - 3 / 0.9) < 1e-6);
});

test("official fee sits outside list plus markup", () => {
  const quote = chatSettleQuote(1.15, 2.3, 50, true, 0.1);
  assert.ok(Math.abs(quote.ownerIn - 1.15 * 0.5) < 1e-6);
  assert.ok(Math.abs(quote.ownerOut - 2.3 * 0.5) < 1e-6);
  assert.ok(Math.abs(quote.hunterIn - (1.15 * 1.5) / 0.9) < 1e-6);
  assert.ok(Math.abs(quote.hunterOut - (2.3 * 1.5) / 0.9) < 1e-6);
});

test("official markup zero still pays the fee outside the list", () => {
  const quote = chatSettleQuote(1.15, 2.3, 0, true, 0.1);
  assert.ok(Math.abs(quote.hunterIn - 1.15 / 0.9) < 1e-6);
  assert.ok(Math.abs(quote.hunterOut - 2.3 / 0.9) < 1e-6);
  assert.equal(quote.ownerIn, 0);
  assert.equal(quote.ownerOut, 0);
});
