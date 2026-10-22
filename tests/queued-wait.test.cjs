const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/ranch-shell/settleQueuedDelivery.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const api = {};
new Function("exports", js)(api);

test("a fresh queued message stays on the short waiting label", () => {
  const now = Date.parse("2026-10-17T02:00:00Z");
  assert.equal(api.queuedStillWaiting("2026-10-17T01:59:30Z", now), false);
});

test("a queued message waiting two minutes asks for a next step", () => {
  const now = Date.parse("2026-10-17T02:00:00Z");
  assert.equal(api.queuedStillWaiting("2026-10-17T01:58:00Z", now), true);
});

test("a queued message with no time shows the next step", () => {
  assert.equal(api.queuedStillWaiting("", 0), true);
});
