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
const {
  formatCnyPerMillion,
  formatCnyPerMillionShort,
  formatLocalPerMillion,
  formatMenuSide,
  formatMenuSideShort,
  formatUsdPerMillion,
  formatUsdPerMillionShort,
} = moduleExports;

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

test("chip prices keep cheap models distinct", () => {
  assert.equal(formatUsdPerMillionShort(0.04843), "$0.048");
  assert.equal(formatUsdPerMillionShort(0.102), "$0.102");
  assert.equal(formatUsdPerMillionShort(0.1917), "$0.192");
  assert.equal(formatUsdPerMillionShort(0.6389), "$0.639");
  assert.equal(formatUsdPerMillionShort(1.533), "$1.53");
  assert.equal(formatUsdPerMillionShort(4), "$4");
  assert.equal(formatUsdPerMillionShort(0.001234), "$0.00123");
  assert.equal(formatCnyPerMillionShort(0.6), "¥0.6");
  assert.equal(formatCnyPerMillionShort(1.2), "¥1.2");
  assert.equal(
    formatMenuSideShort(
      { input_price_per_million: 0.04843, output_price_per_million: 0.102 },
      "input",
    ),
    "$0.048",
  );
  assert.equal(
    formatMenuSideShort(
      { input_price_per_million: 0.1917, output_price_per_million: 0.6389 },
      "output",
    ),
    "$0.639",
  );
  assert.equal(
    formatMenuSideShort(
      {
        input_price_cny_per_million: 0.6,
        output_price_cny_per_million: 1.2,
      },
      "input",
    ),
    "¥0.6",
  );
});

test("menu prices keep four significant digits", () => {
  assert.equal(formatUsdPerMillion(0.383333), "$0.3833");
  assert.equal(formatUsdPerMillion(1.53333), "$1.533");
  assert.equal(formatUsdPerMillion(0.0472778), "$0.04728");
  assert.equal(formatCnyPerMillion(4), "¥4");
});
