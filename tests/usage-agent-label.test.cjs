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

const { indexUsageAgentNames, usageAgentLabel, usageShareLabel } = load(
  "../packages/agent-chat/src/usageAgentLabel.ts",
);
const { ranchMessages } = load("../packages/agent-chat/src/ranch-shell/i18n.ts");

const id = "10eaa979-0379-4940-b281-49edcb82bb2e";

test("a known agent shows its name, not the id", () => {
  const names = indexUsageAgentNames([
    { agentId: id, name: "星币柜台" },
    { agentId: `acn:${id}`, name: "10eaa979-0379-4940-b281-49edcb82bb2e" },
    { agentId: "other-agent", name: "other-agent" },
  ]);
  assert.equal(names[id], "星币柜台");
  assert.equal(usageAgentLabel(id, names[id], "未知智能体").text, "星币柜台");
  assert.equal(usageAgentLabel(`acn:${id}`, names[id], "未知智能体").showId, false);
  assert.deepEqual(usageAgentLabel("other-agent", names["other-agent"], "未知智能体"), {
    text: "other-ag",
    showId: true,
  });
  assert.equal(usageAgentLabel("unknown", null, "未知智能体").text, "未知智能体");
  assert.equal(usageAgentLabel("ab12", null, "未知智能体").text, "ab12");
});

test("China and overseas Chinese name the unknown row, and English stays English", () => {
  const zh = ranchMessages("zh", true);
  const overseas = ranchMessages("zh", false);
  const en = ranchMessages("en", true);
  assert.equal(zh.accountPlanAgentUnknown, "未知智能体");
  assert.equal(overseas.accountPlanAgentUnknown, "未知智能体");
  assert.equal(en.accountPlanAgentUnknown, "Unknown agent");
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/AccountPanels.tsx"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  assert.match(panel, /row\.name \|\| agentNames\[usageAgentKey\(row\.agent_id\)\]/);
  assert.match(panel, /usageAgentLabel\(/);
  assert.doesNotMatch(panel, />\s*\{row\.agent_id\}\s*</);
  assert.match(shell, /agentLabels=\{\[/);
});

test("a share under 1% says under 1%, and 1% stays an integer", () => {
  const zh = ranchMessages("zh", true);
  const overseas = ranchMessages("zh", false);
  const en = ranchMessages("en", false);
  assert.equal(usageShareLabel(0.004, zh.accountPlanUsedPct, zh.accountPlanUsedUnderOne), "不到 1%");
  assert.equal(usageShareLabel(0.004, overseas.accountPlanUsedPct, overseas.accountPlanUsedUnderOne), "不到 1%");
  assert.equal(usageShareLabel(0.004, en.accountPlanUsedPct, en.accountPlanUsedUnderOne), "under 1%");
  assert.equal(usageShareLabel(0.01, zh.accountPlanUsedPct, zh.accountPlanUsedUnderOne), "已用 1%");
  assert.equal(usageShareLabel(0.016, en.accountPlanUsedPct, en.accountPlanUsedUnderOne), "2% used");
  assert.equal(usageShareLabel(0, zh.accountPlanUsedPct, zh.accountPlanUsedUnderOne), "已用 0%");
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/AccountPanels.tsx"),
    "utf8",
  );
  assert.match(panel, /usageShareLabel\(\s*ratio,/);
});
