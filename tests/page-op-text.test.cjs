const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/pageOpText.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { pageOpLine, pageRefLine } = moduleExports;

const conflict = {
  actor_id: "agent-a",
  action: "update",
  outcome: "failed",
  reason: "conflict",
  block_key: "agent-a:main",
};

test("page records render in the active language", () => {
  const zh = pageOpLine("zh", conflict, "小稿");
  const en = pageOpLine("en", conflict, "Xiao");
  assert.match(zh, /小稿/);
  assert.match(zh, /刚被改过/);
  assert.match(zh, /main/);
  assert.match(en, /Xiao/);
  assert.match(en, /just changed/);
  assert.equal(zh.includes("just changed"), false);
  assert.equal(en.includes("刚被改过"), false);
});

test("a missing version is not described as a conflict", () => {
  const zh = pageOpLine(
    "zh",
    { action: "update", outcome: "failed", reason: "missing_rev", block_key: "agent-a:main" },
    "小稿",
  );
  const en = pageOpLine(
    "en",
    { action: "update", outcome: "failed", reason: "missing_rev", block_key: "agent-a:main" },
    "Xiao",
  );
  assert.match(zh, /没有带上当前版本/);
  assert.match(zh, /main/);
  assert.equal(zh.includes("刚被改过"), false);
  assert.match(en, /without the current version/);
  assert.equal(en.includes("just changed"), false);
});

test("a dropped topic stays in the success record", () => {
  const zh = pageOpLine(
    "zh",
    { action: "create", outcome: "ok", block_key: "agent-a:main", rev: 1, topic_dropped: true },
    "小稿",
  );
  const en = pageOpLine(
    "en",
    { action: "create", outcome: "ok", block_key: "agent-a:main", rev: 1, topic_dropped: true },
    "Xiao",
  );
  assert.match(zh, /主时间线/);
  assert.match(en, /main timeline/);
  assert.equal(en.includes("主时间线"), false);
  assert.equal(zh.includes("main timeline"), false);
});

test("a successful write names who changed which block", () => {
  const line = pageOpLine(
    "zh",
    { action: "update", outcome: "ok", block_key: "agent-a:main", rev: 2 },
    "小稿",
  );
  assert.match(line, /小稿/);
  assert.match(line, /更新/);
  assert.match(line, /main/);
  assert.match(line, /2/);
});

test("a pointer uses the block title in the active language", () => {
  const ref = { block_key: "agent-a:main", rev: 2, title: "说明" };
  const zh = pageRefLine("zh", ref);
  const en = pageRefLine("en", ref);
  assert.match(zh, /说明/);
  assert.match(zh, /第 2 版/);
  assert.equal(zh.includes("Pointing"), false);
  assert.match(en, /说明/);
  assert.match(en, /rev 2/);
  assert.equal(en.includes("指向"), false);
});
