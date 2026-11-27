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
const {
  decisionAutoLine,
  decisionCallUsage,
  decisionEventLine,
  decisionStoppedLine,
  isAutoDecisionMessage,
  judgmentMark,
  judgmentNeedsStoppedLine,
} = moduleExports;

test("an older picked line borrows the model from the judged reply", () => {
  const reply = {
    message_id: "reply-1",
    sender_type: "agent",
    metadata: {
      orchestration: { decide: { shadow: { model: "jev-1.14.0", status: "scored" } } },
    },
  };
  const picked = {
    sender_type: "user",
    content: "再做一次刚才只回复 alpha 的那件事",
    metadata: { decision: { auto: true, source_message_id: "reply-1" } },
  };
  assert.equal(
    decisionEventLine("en", picked),
    "Auto-decide picked “再做一次刚才只回复 alpha 的那件事”.",
  );
  assert.deepEqual(decisionCallUsage(picked, [reply]), { modelId: "jev-1.14.0", input: null });
  assert.equal(judgmentNeedsStoppedLine(reply, [reply, picked]), false);
});

test("a judged reply that sent nothing shows a stopped event", () => {
  const gamma = {
    message_id: "gamma-1",
    sender_type: "agent",
    metadata: {
      orchestration: {
        decide: { shadow: { model: "jev-1.14.0", usage: { input_tokens: 1895 }, status: "ask_human" } },
      },
    },
  };
  assert.equal(judgmentNeedsStoppedLine(gamma, [gamma]), true);
  assert.deepEqual(judgmentMark(gamma), { modelId: "jev-1.14.0", input: 1895 });
  assert.equal(decisionStoppedLine("zh"), "自动决策停住了。");
  assert.equal(decisionStoppedLine("en"), "Auto-decide stopped.");
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
