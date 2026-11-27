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
const { decisionAutoLine, decisionEventLine, decisionUsageFromMessage, isAutoDecisionMessage } = moduleExports;

test("a judgment's model sits on the decision event", () => {
  const sent = {
    sender_type: "user",
    content: "再做一次刚才只回复 alpha 的那件事",
    metadata: {
      decision: { auto: true, model: "jev-1.14.0", input_tokens: 1895 },
    },
  };
  assert.equal(
    decisionEventLine("en", sent),
    "Auto-decide picked “再做一次刚才只回复 alpha 的那件事”.",
  );
  assert.deepEqual(decisionUsageFromMessage(sent), { modelId: "jev-1.14.0", input: 1895 });
  const stopped = {
    sender_type: "system",
    content: "",
    metadata: { decision: { auto: true, event: "stopped", model: "jev-1.14.0", input_tokens: 1895 } },
  };
  assert.equal(decisionEventLine("zh", stopped), "自动决策停住了。");
  assert.equal(decisionEventLine("en", stopped), "Auto-decide stopped.");
});

test("an agent reply does not carry the judgment usage", () => {
  assert.equal(
    decisionUsageFromMessage({
      sender_type: "agent",
      metadata: {
        usage: { input_tokens: 62618, output_tokens: 62, model_id: "deepseek-chat" },
        orchestration: { decide: { shadow: { model: "jev-1.14.0", usage: { input_tokens: 1895 } } } },
      },
    }),
    null,
  );
});

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
