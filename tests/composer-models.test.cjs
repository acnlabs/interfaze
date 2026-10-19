const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadShell(file) {
  const dir = path.join(__dirname, "../packages/agent-chat/src/ranch-shell");
  const cache = {};
  function localRequire(spec) {
    if (spec === "./officialV0") {
      cache.officialV0 ??= evalFile(path.join(dir, "officialV0.ts"));
      return cache.officialV0;
    }
    return require(spec);
  }
  function evalFile(abs) {
    const js = ts.transpileModule(fs.readFileSync(abs, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const moduleExports = {};
    new Function("exports", "require", js)(moduleExports, localRequire);
    return moduleExports;
  }
  return evalFile(path.join(dir, file));
}

const {
  choosePricedComposer,
  pricedReportedIds,
  composerMenuIds,
  composerProviderName,
  agentProviderPricedIds,
  composerCatalogForOffer,
  unpricedOwnModelIds,
  providerDownFromMessages,
  refusedModelNames,
  resolveComposerOffer,
  vendorsNeedingReport,
} = loadShell("composerModels.ts");

test("official menu is the authorized set, not the catalog shelf", () => {
  const ids = composerMenuIds({
    official: true,
    listed: "deepseek/deepseek-v4-flash",
    supported: ["tencenttokenplan/kimi-k2.5", "tencenttokenplan/deepseek-v4-flash-202605"],
    officialIds: ["deepseek/deepseek-v4-flash", "openai/gpt-4o", "moonshotai/kimi-k2.5"],
    keyGeo: "cn",
  });
  assert.deepEqual(ids, ["deepseek/deepseek-v4-flash", "moonshotai/kimi-k2.5"]);
});

test("an agent's own key does not inherit the official shelf", () => {
  const ids = composerMenuIds({
    official: false,
    listed: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: [
      "tencenttokenplan/deepseek-v4-flash-202605",
      "tencenttokenplan/kimi-k2.5",
    ],
    officialIds: ["moonshotai/kimi-k2.5", "openai/gpt-4o"],
    keyGeo: "cn",
  });
  assert.deepEqual(ids, [
    "tencenttokenplan/deepseek-v4-flash-202605",
    "tencenttokenplan/kimi-k2.5",
  ]);
});

test("the menu is the agent's report, including names a shell-side catalog would drop", () => {
  const offer = resolveComposerOffer({
    listed: "tencenttokenplan/kimi-k2.5",
    runtime: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: [
      "tencenttokenplan/kimi-k2.5",
      "tencenttokenplan/tc-code-latest",
      "tencenttokenplan/deepseek-v4-flash-202605",
    ],
    officialIds: ["openai/gpt-4o"],
    keyGeo: "cn",
    live: {
      tencenttokenplan: ["deepseek-v4-flash-202605", "glm-5.3", "deepseek/deepseek-flash"],
    },
  });
  assert.equal(offer.official, false);
  assert.equal(offer.vendor, "tencenttokenplan");
  assert.deepEqual(offer.ids, [
    "tencenttokenplan/deepseek-v4-flash-202605",
    "tencenttokenplan/kimi-k2.5",
    "tencenttokenplan/tc-code-latest",
  ]);
});

test("the menu keeps a reported id that itself contains a slash", () => {
  const offer = resolveComposerOffer({
    listed: "tencenttokenplan/deepseek/deepseek-flash",
    runtime: "tencenttokenplan/deepseek/deepseek-flash",
    supported: [
      "tencenttokenplan/deepseek/deepseek-flash",
      "tencenttokenplan/kimi-k2.5",
    ],
    officialIds: [],
    keyGeo: "cn",
    live: { tencenttokenplan: ["deepseek/deepseek-flash", "glm-5.3"] },
  });
  assert.deepEqual(offer.ids, [
    "tencenttokenplan/deepseek/deepseek-flash",
    "tencenttokenplan/kimi-k2.5",
  ]);
});

test("a refusal sentence names the model even when the provider text is cut off", () => {
  const names = refusedModelNames(
    "tencenttokenplan/kimi-k2.5 was refused: complete_exit_1:GatewayClientRequestError: FailoverError: 403 The current API Key is not autho",
  );
  assert.deepEqual(names, ["tencenttokenplan/kimi-k2.5"]);
});

test("a refused model leaves the menu", () => {
  const ids = composerMenuIds({
    official: false,
    listed: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: ["tencenttokenplan/kimi-k2.5", "tencenttokenplan/deepseek-v4-flash-202605"],
    officialIds: [],
    keyGeo: "cn",
    refusedIds: refusedModelNames(
      "403 The current API Key is not authorized to access model kimi-k2.5.",
    ),
  });
  assert.deepEqual(ids, ["tencenttokenplan/deepseek-v4-flash-202605"]);
});

test("a down provider moves to the next one the agent reported", () => {
  const offer = resolveComposerOffer({
    listed: "tencenttokenplan/deepseek-v4-flash-202605",
    runtime: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: [
      "tencenttokenplan/deepseek-v4-flash-202605",
      "openrouter/gpt-4o-mini",
    ],
    officialIds: ["openai/gpt-4o"],
    keyGeo: "cn",
    live: { tencenttokenplan: "down" },
  });
  assert.equal(offer.official, false);
  assert.equal(offer.vendor, "openrouter");
  assert.deepEqual(offer.ids, ["openrouter/gpt-4o-mini"]);
});

test("no working provider falls through to the official list", () => {
  const offer = resolveComposerOffer({
    listed: "tencenttokenplan/kimi-k2.5",
    runtime: "tencenttokenplan/kimi-k2.5",
    supported: ["tencenttokenplan/kimi-k2.5"],
    officialIds: ["deepseek/deepseek-v4-flash", "openai/gpt-4o"],
    keyGeo: "cn",
    live: { tencenttokenplan: "down" },
    refusedIds: ["kimi-k2.5"],
  });
  assert.equal(offer.official, true);
  assert.deepEqual(offer.ids, ["deepseek/deepseek-v4-flash"]);
});

test("an empty catalog leaves the agent's report in place", () => {
  const offer = resolveComposerOffer({
    listed: "tencenttokenplan/deepseek-v4-flash-202605",
    runtime: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: [
      "tencenttokenplan/deepseek-v4-flash-202605",
      "tencenttokenplan/kimi-k2.5",
    ],
    officialIds: ["openai/gpt-4o"],
    keyGeo: "cn",
    live: { tencenttokenplan: [] },
  });
  assert.equal(offer.official, false);
  assert.equal(offer.vendor, "tencenttokenplan");
  assert.deepEqual(offer.ids, [
    "tencenttokenplan/deepseek-v4-flash-202605",
    "tencenttokenplan/kimi-k2.5",
  ]);
});

test("only the latest agent reply can take a provider out", () => {
  const older = {
    sender_type: "agent",
    content: "The API Key does not exist or signature verification failed.",
  };
  const later = { sender_type: "agent", content: "改好了。" };
  const quoted = {
    sender_type: "human",
    content: "The API Key does not exist or signature verification failed.",
  };
  assert.equal(providerDownFromMessages([older, later]), false);
  assert.equal(providerDownFromMessages([later, older]), true);
  assert.equal(providerDownFromMessages([quoted]), false);
});

test("a provider without a live catalog needs the agent to report again", () => {
  assert.deepEqual(
    vendorsNeedingReport(["tencenttokenplan", "moonshot"], {}),
    ["tencenttokenplan", "moonshot"],
  );
  assert.deepEqual(
    vendorsNeedingReport(["tencenttokenplan", "moonshot"], {
      tencenttokenplan: ["deepseek-v4-flash-202605"],
    }),
    ["tencenttokenplan", "moonshot"],
  );
  assert.deepEqual(
    vendorsNeedingReport(["tencenttokenplan"], { tencenttokenplan: "down" }),
    [],
  );
});

test("a provider we cannot ask uses the report the agent just sent", () => {
  const offer = resolveComposerOffer({
    listed: "moonshot/kimi-k2",
    runtime: "moonshot/kimi-k2",
    supported: ["moonshot/kimi-k2", "moonshot/kimi-k2.6"],
    officialIds: ["openai/gpt-4o"],
    keyGeo: "global",
  });
  assert.equal(offer.official, false);
  assert.equal(offer.vendor, "moonshot");
  assert.deepEqual(offer.ids, ["moonshot/kimi-k2", "moonshot/kimi-k2.6"]);
});

test("unpriced own models switch to priced official models", () => {
  const offer = choosePricedComposer({
    listed: "tencenttokenplan/kimi-k2.5",
    runtime: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: [
      "tencenttokenplan/kimi-k2.5",
      "tencenttokenplan/deepseek-v4-flash-202605",
    ],
    officialIds: [],
    keyGeo: "cn",
    pricedOwnIds: [],
    officialPricedIds: [
      "openai/gpt-4o",
      "moonshotai/kimi-k2.5",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1",
    ],
  });
  assert.equal(offer.official, true);
  assert.equal(offer.vendor, "OpenRouter");
  assert.equal(offer.ids[0], "deepseek/deepseek-chat");
  assert.ok(offer.ids.includes("moonshotai/kimi-k2.5"));
  assert.equal(offer.ids.includes("openai/gpt-4o"), false);
  assert.equal(offer.ids.includes("deepseek/deepseek-r1"), false);
  assert.equal(offer.ids.includes("tencenttokenplan/kimi-k2.5"), false);
});

test("an option marked unpriceable stays unusable even if a catalog row exists", () => {
  assert.deepEqual(
    pricedReportedIds(
      ["tencenttokenplan/kimi-k2.5", "deepseek/deepseek-chat"],
      [{ model_id: "tencenttokenplan/kimi-k2.5", priceable: false }],
      ["deepseek/deepseek-chat"],
    ),
    ["deepseek/deepseek-chat"],
  );
});

test("a priced own model stays on the agent's provider", () => {
  const offer = choosePricedComposer({
    listed: "tencenttokenplan/kimi-k2.5",
    runtime: "tencenttokenplan/deepseek-v4-flash-202605",
    supported: [
      "tencenttokenplan/kimi-k2.5",
      "tencenttokenplan/deepseek-v4-flash-202605",
    ],
    officialIds: ["deepseek/deepseek-chat"],
    keyGeo: "cn",
    pricedOwnIds: ["tencenttokenplan/deepseek-v4-flash-202605"],
    officialPricedIds: ["deepseek/deepseek-chat", "moonshotai/kimi-k2.5"],
  });
  assert.equal(offer.official, false);
  assert.equal(offer.vendor, "tencenttokenplan");
  assert.deepEqual(offer.ids, ["tencenttokenplan/deepseek-v4-flash-202605"]);
});

test("an official list stays while its prices are still loading", () => {
  const offer = choosePricedComposer({
    listed: null,
    runtime: null,
    supported: [],
    officialIds: ["deepseek/deepseek-v4-flash", "moonshotai/kimi-k2.5"],
    keyGeo: "cn",
    pricedOwnIds: [],
    officialPricedIds: [],
  });
  assert.equal(offer.official, true);
  assert.deepEqual(offer.ids, ["deepseek/deepseek-v4-flash", "moonshotai/kimi-k2.5"]);
});

test("a loaded official list keeps the priced authorized models", () => {
  const offer = choosePricedComposer({
    listed: null,
    runtime: null,
    supported: [],
    officialIds: ["moonshotai/kimi-k2.5"],
    keyGeo: "cn",
    pricedOwnIds: [],
    officialPricedIds: [
      "deepseek/deepseek-chat",
      "moonshotai/kimi-k2.5",
      "openai/gpt-4o",
    ],
  });
  assert.equal(offer.official, true);
  assert.deepEqual(offer.ids, ["moonshotai/kimi-k2.5"]);
});

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
  assert.deepEqual(
    composerCatalogForOffer({
      reportedIds: reported,
      modelOptions: options,
      catalogIds: ["aion-labs/aion-2.0", "deepseek/deepseek-chat"],
    }),
    [],
  );
});

test("unpriced own models show official prices while the agent is asked to quote", () => {
  const reported = ["tencenttokenplan/kimi-k2.5"];
  const options = [];
  assert.deepEqual(unpricedOwnModelIds(reported, options), reported);
  assert.deepEqual(
    composerCatalogForOffer({
      reportedIds: reported,
      modelOptions: options,
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

test("the button names the provider that will be called", () => {
  assert.equal(composerProviderName("tencenttokenplan/kimi-k2.5", false), "tencenttokenplan");
  assert.equal(composerProviderName("deepseek/deepseek-v4-flash", true), "OpenRouter");
});
