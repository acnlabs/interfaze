const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/messageMarkdown.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { parseMessageMarkdown } = moduleExports;

test("bold, inline code, lists, and tables become structure", () => {
  const blocks = parseMessageMarkdown(
    "**加粗** and `code`\n\n- 甲\n- 乙\n\n| 镜头 | 时间 |\n| --- | --- |\n| 开场 | 3s |",
  ).filter((block) => block.type !== "gap");
  assert.equal(blocks[0].type, "paragraph");
  assert.deepEqual(blocks[0].inlines[0], { type: "strong", text: "加粗" });
  assert.deepEqual(blocks[0].inlines[2], { type: "code", text: "code" });
  assert.equal(blocks[1].type, "list");
  assert.equal(blocks[1].ordered, false);
  assert.equal(blocks[1].items.length, 2);
  assert.equal(blocks[2].type, "table");
  assert.deepEqual(blocks[2].header, ["镜头", "时间"]);
  assert.deepEqual(blocks[2].rows, [["开场", "3s"]]);
});

test("a plain message stays text", () => {
  const blocks = parseMessageMarkdown("hello\nworld");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  assert.deepEqual(blocks[0].inlines, [
    { type: "text", text: "hello" },
    { type: "break" },
    { type: "text", text: "world" },
  ]);
});

test("a blank line between paragraphs stays visible", () => {
  const blocks = parseMessageMarkdown("hello\n\nworld");
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "gap", "paragraph"]);
});

test("markup is not parsed inside inline code", () => {
  const blocks = parseMessageMarkdown("`**not bold**`");
  assert.deepEqual(blocks[0].inlines, [{ type: "code", text: "**not bold**" }]);
});

test("a # heading becomes a heading, not a line starting with a hash", () => {
  const blocks = parseMessageMarkdown("# 15s 自我介绍 · 口播稿\n对齐 6 镜头\n## 小节 ##\n#话题 不是标题");
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[0].inlines[0].text, "15s 自我介绍 · 口播稿");
  assert.equal(blocks[1].type, "paragraph");
  assert.equal(blocks[2].type, "heading");
  assert.equal(blocks[2].level, 2);
  assert.equal(blocks[2].inlines[0].text, "小节");
  assert.equal(blocks[3].type, "paragraph");
});
