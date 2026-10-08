const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/chatLink.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { blockKeyFromSearch, chatIdFromSearch, chatPageLink } = moduleExports;

test("a chat link names the chat and does not add a token", () => {
  const link = chatPageLink("http://localhost:3010", "chat-1", "agent:main");
  const url = new URL(link);
  assert.equal(url.origin + url.pathname, "http://localhost:3010/");
  assert.equal(url.searchParams.get("chat"), "chat-1");
  assert.equal(url.searchParams.get("block"), "agent:main");
  assert.equal(url.searchParams.get("token"), null);
});

test("a link without a block is just the chat", () => {
  const url = new URL(chatPageLink("https://interfaze.io", "chat-1"));
  assert.equal(url.searchParams.get("chat"), "chat-1");
  assert.equal(url.searchParams.get("block"), null);
});

test("the chat id is read back from the query", () => {
  assert.equal(chatIdFromSearch("?chat=chat-1&block=agent%3Amain"), "chat-1");
  assert.equal(blockKeyFromSearch("?chat=chat-1&block=agent%3Amain"), "agent:main");
  assert.equal(chatIdFromSearch(""), null);
  assert.equal(blockKeyFromSearch("?chat=chat-1"), null);
});
