const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/manuscriptPage.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { parseTableBody, visibleManuscriptBlocks } = moduleExports;

const blocks = [
  { block_key: "a:main", type: "text", body: "main", rev: 1, creator_agent_id: "a", updated_by_agent_id: "a", thread_id: null },
  { block_key: "a:topic", type: "html", body: "<p>t</p>", rev: 1, creator_agent_id: "a", updated_by_agent_id: "a", thread_id: "topic-1" },
];

test("main timeline hides topic blocks", () => {
  const visible = visibleManuscriptBlocks(blocks, null);
  assert.deepEqual(visible.map((block) => block.block_key), ["a:main"]);
});

test("a topic shows only its blocks", () => {
  const visible = visibleManuscriptBlocks(blocks, "topic-1");
  assert.deepEqual(visible.map((block) => block.block_key), ["a:topic"]);
});

test("a table body is columns and rows of strings", () => {
  const table = parseTableBody('{"columns":["名称"],"rows":[["苹果"]]}');
  assert.deepEqual(table, { columns: ["名称"], rows: [["苹果"]] });
  assert.equal(parseTableBody("| a | b |"), null);
  assert.equal(parseTableBody('{"columns":["a"],"rows":[[1]]}'), null);
});
