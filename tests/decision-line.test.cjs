const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/decisionLine.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { decisionAutoLine, isAutoDecisionMessage } = moduleExports;

test("auto-decide turns render as a decision line", () => {
  const message = {
    sender_type: "user",
    content: "回复 alpha",
    metadata: { decision: { auto: true, option_id: "alpha" } },
  };
  assert.equal(isAutoDecisionMessage(message), true);
  assert.equal(decisionAutoLine("zh", message.content), "自动决策选了「回复 alpha」");
  assert.equal(decisionAutoLine("en", message.content), "Auto-decide picked “回复 alpha”.");
});

test("a click the person made stays their own message", () => {
  assert.equal(
    isAutoDecisionMessage({
      sender_type: "user",
      content: "回复 alpha",
      metadata: { decision: { auto: false, option_id: "alpha" } },
    }),
    false,
  );
  assert.equal(
    isAutoDecisionMessage({
      sender_type: "agent",
      content: "回复 alpha",
      metadata: { decision: { auto: true } },
    }),
    false,
  );
  assert.equal(
    isAutoDecisionMessage({
      sender_type: "user",
      content: "   ",
      metadata: { decision: { auto: true } },
    }),
    false,
  );
});
