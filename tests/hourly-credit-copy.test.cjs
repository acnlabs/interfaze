const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/hourlyCreditCopy.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { hourlyCreditCopy } = moduleExports;

test("China Chinese still names the hourly unit 星币", () => {
  const copy = hourlyCreditCopy("zh", true);
  assert.equal(copy.screenAt, "打开电脑屏幕 · {rate} 星币/小时");
  assert.equal(copy.sendAt, "发送 · {rate} 星币/小时");
  assert.equal(copy.sendConfirm, "发送后电脑按 {rate} 星币/小时计费。不用的预扣会退回。");
  assert.equal(copy.pausedAt, "暂停 {rate} 星币/小时");
  assert.equal(copy.runningAt, "开着 {rate} 星币/小时");
  assert.equal(copy.pauseAt, "暂停 · {rate} 星币/小时");
  assert.equal(copy.resumeAt, "恢复 · {rate} 星币/小时");
  assert.equal(copy.resumeConfirm, "恢复按 {rate} 星币/小时计费。不用的预扣会退回。");
  assert.equal(copy.pauseConfirm, "暂停后按 {rate} 星币/小时计费。");
});

test("overseas Chinese names the hourly unit credit", () => {
  const copy = hourlyCreditCopy("zh-CN", false);
  assert.equal(copy.screenAt, "打开电脑屏幕 · 每小时 {rate} credits");
  assert.equal(copy.sendAt, "发送 · 每小时 {rate} credits");
  assert.equal(copy.sendConfirm, "发送后电脑按每小时 {rate} credits 计费。不用的预扣会退回。");
  assert.equal(copy.pausedAt, "暂停 · 每小时 {rate} credits");
  assert.equal(copy.runningAt, "开着 · 每小时 {rate} credits");
  assert.equal(copy.pauseAt, "暂停 · 每小时 {rate} credits");
  assert.equal(copy.resumeAt, "恢复 · 每小时 {rate} credits");
  assert.equal(copy.resumeConfirm, "恢复后电脑按每小时 {rate} credits 计费。不用的预扣会退回。");
  assert.equal(copy.pauseConfirm, "暂停后电脑按每小时 {rate} credits 计费。");
  for (const line of Object.values(copy)) assert.equal(line.includes("星币"), false);
});

test("English stays credits on both sites", () => {
  const china = hourlyCreditCopy("en", true);
  const overseas = hourlyCreditCopy("en", false);
  assert.deepEqual(china, overseas);
  assert.equal(china.screenAt, "Open computer screen · {rate}/hr");
  assert.equal(china.sendAt, "Send · {rate}/hr");
  assert.equal(china.pausedAt, "Paused · {rate}/hr");
  assert.equal(lineHasXingbi(china), false);
});

function lineHasXingbi(copy) {
  return Object.values(copy).some((line) => line.includes("星币"));
}

test("the embed and the old assistant shell use the same sentences", () => {
  const embed = fs.readFileSync(
    path.join(__dirname, "../src/components/InterfazeEmbedHost.tsx"),
    "utf8",
  );
  const assistant = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/AgentChatShell.tsx"),
    "utf8",
  );
  assert.match(embed, /hourlyCreditCopy\(zh \? "zh" : "en", isCnRegion\(\)\)/);
  assert.match(embed, /rates\.sendConfirm/);
  assert.match(embed, /rates\.sendAt/);
  assert.doesNotMatch(embed, /星币/);
  assert.match(
    assistant,
    /hourlyCreditCopy\(\s*isAssistant \? "zh" : "en",\s*isCnInterfazeOrigin\(resolveInterfazeOrigin\(\)\)/,
  );
  assert.doesNotMatch(assistant, /星币/);
});
