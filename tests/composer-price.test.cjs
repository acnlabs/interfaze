const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/composerPrice.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { formatCnyPerMillion, formatLocalPerMillion, formatMenuSide, formatUsdPerMillion } = moduleExports;

test("a local rate prints yuan only when the book says CNY", () => {
  assert.equal(formatLocalPerMillion(0.69, "CNY"), "¥0.69");
  assert.equal(formatLocalPerMillion(0.1725, "USD"), formatUsdPerMillion(0.1725));
});

test("yuan labels keep the stored list rate", () => {
  assert.equal(formatCnyPerMillion(0.6), "¥0.6");
  assert.equal(formatCnyPerMillion(1.2), "¥1.2");
  assert.equal(formatCnyPerMillion(4), "¥4");
});

test("a China menu option prints yuan and an OpenRouter option prints dollars", () => {
  const china = formatMenuSide(
    {
      input_price_per_million: 0.6 / 7.2,
      output_price_per_million: 1.2 / 7.2,
      input_price_cny_per_million: 0.6,
      output_price_cny_per_million: 1.2,
    },
    "input",
  );
  assert.equal(china, "¥0.6");
  const overseas = formatMenuSide(
    { input_price_per_million: 1.15, output_price_per_million: 2.3 },
    "input",
  );
  assert.equal(overseas, formatUsdPerMillion(1.15));
  assert.match(overseas, /^\$/);
});

test("menu prices keep four significant digits", () => {
  assert.equal(formatUsdPerMillion(0.383333), "$0.3833");
  assert.equal(formatUsdPerMillion(1.53333), "$1.533");
  assert.equal(formatUsdPerMillion(0.0472778), "$0.04728");
  assert.equal(formatCnyPerMillion(4), "¥4");
});
