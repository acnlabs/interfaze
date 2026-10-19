const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/composerQuote.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const {
  agentModelIdForSend,
  agentProviderPricedIds,
  composerCatalogForOffer,
  composerPricedMenuIds,
  mergeQuotedPrices,
  pricedOptionForId,
  quotedPricesFromOptions,
  reportedIdsForSend,
  unpricedOwnModelIds,
} = moduleExports;

test("a priced provider shows its own models, not the OpenRouter shelf", () => {
  const reported = [
    "tencenttokenplan/kimi-k2.5",
    "tencenttokenplan/glm-5",
    "tencenttokenplan/deepseek-v4-flash-202605",
  ];
  const options = [
    {
      model_id: "moonshotai/kimi-k2.5",
      input_price_per_million: 1,
      output_price_per_million: 4,
    },
    {
      model_id: "z-ai/glm-5",
      input_price_per_million: 2,
      output_price_per_million: 6,
    },
    {
      model_id: "deepseek/deepseek-chat",
      input_price_per_million: 0.5,
      output_price_per_million: 1.5,
    },
  ];
  assert.deepEqual(agentProviderPricedIds(reported, options), [
    "moonshotai/kimi-k2.5",
    "z-ai/glm-5",
  ]);
  assert.deepEqual(unpricedOwnModelIds(reported, options), [
    "tencenttokenplan/deepseek-v4-flash-202605",
  ]);
  assert.equal(
    pricedOptionForId("tencenttokenplan/kimi-k2.5", options).model_id,
    "moonshotai/kimi-k2.5",
  );
  assert.equal(pricedOptionForId("deepseek/deepseek-v4-flash", options), null);
  assert.deepEqual(
    composerPricedMenuIds(["tencenttokenplan/kimi-k2.5"], options).map((id) => id.split("/").pop()),
    ["kimi-k2.5", "glm-5", "deepseek-chat"],
  );
  assert.deepEqual(
    composerCatalogForOffer({
      reportedIds: reported,
      modelOptions: options,
      catalogIds: ["aion-labs/aion-2.0", "deepseek/deepseek-chat"],
    }),
    [],
  );
});

test("send uses the agent's provider id for a price-book row", () => {
  const reported = [
    "tencenttokenplan/kimi-k2.5",
    "tencenttokenplan/deepseek-v4-flash-202605",
  ];
  assert.equal(
    agentModelIdForSend("moonshotai/kimi-k2.5", reported),
    "tencenttokenplan/kimi-k2.5",
  );
  assert.equal(
    agentModelIdForSend("tencenttokenplan/kimi-k2.5", reported),
    "tencenttokenplan/kimi-k2.5",
  );
  assert.equal(
    agentModelIdForSend("deepseek/deepseek-chat", reported),
    "deepseek/deepseek-chat",
  );
  assert.equal(
    agentModelIdForSend(
      "moonshotai/kimi-k2.5",
      reportedIdsForSend({
        supported_models: ["tencenttokenplan/kimi-k2.5"],
      }),
    ),
    "tencenttokenplan/kimi-k2.5",
  );
});

test("a price the agent reports joins the menu and leaves the book price alone", () => {
  const reported = [
    "tencenttokenplan/kimi-k2.5",
    "tencenttokenplan/deepseek-v4-flash-202605",
  ];
  const book = [
    {
      model_id: "moonshotai/kimi-k2.5",
      input_price_per_million: 1,
      output_price_per_million: 4,
    },
  ];
  assert.deepEqual(unpricedOwnModelIds(reported, book), [
    "tencenttokenplan/deepseek-v4-flash-202605",
  ]);
  const options = mergeQuotedPrices(book, [
    {
      model_id: "tencenttokenplan/deepseek-v4-flash-202605",
      input_price_per_million: 0.2,
      output_price_per_million: 0.4,
    },
    {
      model_id: "tencenttokenplan/kimi-k2.5",
      input_price_per_million: 9,
      output_price_per_million: 9,
    },
  ]);
  assert.equal(options[0].input_price_per_million, 1);
  assert.equal(options[0].price_from, undefined);
  assert.equal(options[1].price_from, "agent");
  const refreshed = mergeQuotedPrices(
    [{ model_id: "moonshotai/kimi-k2.5", input_price_per_million: 1, output_price_per_million: 4 }],
    quotedPricesFromOptions(options),
  );
  assert.equal(refreshed[0].input_price_per_million, 1);
  assert.equal(
    refreshed.find((row) => row.model_id.endsWith("deepseek-v4-flash-202605")).input_price_per_million,
    0.2,
  );
  assert.deepEqual(unpricedOwnModelIds(reported, options), []);
  assert.deepEqual(
    composerPricedMenuIds(reported, options).map((id) => id.split("/").pop()),
    ["kimi-k2.5", "deepseek-v4-flash-202605"],
  );
});

test("a provider with no priced model uses the official shelf while a quote is open", () => {
  const reported = ["tencenttokenplan/kimi-k2.5"];
  assert.deepEqual(
    composerCatalogForOffer({
      reportedIds: reported,
      modelOptions: [],
      catalogIds: ["deepseek/deepseek-chat"],
    }),
    ["deepseek/deepseek-chat"],
  );
  assert.deepEqual(
    composerCatalogForOffer({
      reportedIds: reported,
      modelOptions: [
        {
          model_id: "tencenttokenplan/kimi-k2.5",
          input_price_per_million: 1,
          output_price_per_million: 2,
        },
      ],
      catalogIds: ["deepseek/deepseek-chat"],
    }),
    [],
  );
});
