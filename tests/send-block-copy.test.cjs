const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(rel) {
  const source = fs.readFileSync(path.join(__dirname, rel), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const moduleExports = {};
  new Function("exports", js)(moduleExports);
  return moduleExports;
}

const { sendBlockKind, sendBlockSentence } = load("../packages/agent-chat/src/sendBlockCopy.ts");
const { ranchMessages } = load("../packages/agent-chat/src/ranch-shell/i18n.ts");

const haveNeed = "insufficient_credits: Insufficient credits. Have 12, need 40";
const usedLimit = "on_demand_limit: Monthly on-demand limit reached. Used 3, limit 10, need 5 more";

test("a rate_limited send names the reason and hides the counts", () => {
  const zh = ranchMessages("zh", true);
  const overseas = ranchMessages("zh", false);
  const en = ranchMessages("en", true);
  assert.equal(sendBlockKind("rate_limited", haveNeed), "insufficient_credits");
  assert.equal(sendBlockKind("rate_limited", usedLimit), "on_demand_limit");
  assert.equal(sendBlockKind("rate_limited", "slow down"), "rate_limited");
  assert.equal(sendBlockSentence("rate_limited", haveNeed, zh), "星币不够，这条发不出去。");
  assert.equal(sendBlockSentence("rate_limited", haveNeed, overseas), "credit 不够，这条发不出去。");
  assert.equal(sendBlockSentence("rate_limited", haveNeed, en), "Not enough credits to send this.");
  assert.equal(
    sendBlockSentence("rate_limited", usedLimit, zh),
    "这个月的按量额度用完了，这条发不出去。",
  );
  assert.equal(
    sendBlockSentence("rate_limited", usedLimit, overseas),
    "这个月的按量额度用完了，这条发不出去。",
  );
  assert.equal(
    sendBlockSentence("rate_limited", usedLimit, en),
    "This month's on-demand limit is used up. This can't be sent.",
  );
  for (const copy of [zh, overseas, en]) {
    const low = sendBlockSentence("rate_limited", haveNeed, copy);
    const cap = sendBlockSentence("rate_limited", usedLimit, copy);
    assert.doesNotMatch(low, /Have|need|12|40/);
    assert.doesNotMatch(cap, /Used|limit 10|need 5/);
  }
});

test("a bare billing code still maps, and other errors do not", () => {
  const en = ranchMessages("en", false);
  assert.equal(
    sendBlockSentence("insufficient_credits", "Insufficient credits. Have 1, need 2", en),
    en.insufficientCredits,
  );
  assert.equal(sendBlockSentence("on_demand_limit", usedLimit, en), en.onDemandLimitReached);
  assert.equal(sendBlockSentence("agent_unreachable", haveNeed, en), null);
  assert.equal(sendBlockSentence("canvas_ref", "bad ref", en), null);
});
