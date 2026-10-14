const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/creditDisplay.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { formatCreditBalance, formatCreditsFromLocal, formatLedgerAmount, formatWholeCredits } = moduleExports;

test("a balance keeps the micro remainder to two decimals", () => {
  assert.equal(formatCreditBalance(10, 14000), "10.01");
  assert.equal(formatCreditBalance(0, 14000), "0.01");
  assert.equal(formatCreditBalance(115, 0), "115.00");
  assert.equal(formatCreditBalance(5800, 500000), "5,800.50");
});

test("a chat hop in micros is shown in credits", () => {
  assert.equal(formatLedgerAmount(115_000_000, "micros"), "115.00");
  assert.equal(formatLedgerAmount(14000, "micros"), "0.01");
  assert.equal(formatLedgerAmount(145000, "micros"), "0.15");
  assert.equal(formatCreditBalance(0, 5000), "0.01");
  assert.equal(formatCreditBalance(1, 4999), "1.00");
});

test("a local price becomes credits at two decimals", () => {
  assert.equal(formatCreditsFromLocal(1.15), "115.00");
  assert.equal(formatCreditsFromLocal(2.3), "230.00");
  assert.equal(formatCreditsFromLocal(0.766667), "76.67");
  assert.equal(formatCreditsFromLocal(0.004), "0.40");
  assert.equal(formatCreditsFromLocal(0), "0.00");
});

test("a top-up stays a whole number", () => {
  assert.equal(formatLedgerAmount(100, "credits"), "100");
  assert.equal(formatLedgerAmount(100), "100");
  assert.equal(formatWholeCredits(2000), "2,000");
});

test("a charge shows a minus even when the stored amount is positive", () => {
  const { formatSignedCreditAmount } = moduleExports;
  assert.equal(formatSignedCreditAmount(115_000_000, "micros", "out"), "-115.00");
  assert.equal(formatSignedCreditAmount(14000, "micros", "out"), "-0.01");
  assert.equal(formatSignedCreditAmount(100, "credits", "in"), "+100");
  assert.equal(formatSignedCreditAmount(50, null, "out"), "-50");
});
