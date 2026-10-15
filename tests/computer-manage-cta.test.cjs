const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/computerManageCta.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { computerManageCta, extraAsksBeforeCreate, pauseAsksBeforeCharge, computerStatusLine } = moduleExports;

test("an empty list creates the default computer", () => {
  assert.equal(computerManageCta(0), "create");
});

test("a list that already has a computer opens an extra", () => {
  assert.equal(computerManageCta(1), "extra");
  assert.equal(computerManageCta(2), "extra");
});

test("the empty panel does not call the extra button 再开一台", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /computerManageCta/);
  assert.match(panel, /create: "创建云电脑"/);
  assert.match(panel, /hasComputer \? t\.open : t\.create/);
  assert.match(panel, /listReady/);
});

test("a listed computer can open its screen without a chat", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  assert.match(panel, /screen: "打开电脑屏幕"/);
  assert.match(panel, /screenAt: "打开电脑屏幕 · \{rate\} 星币\/小时"/);
  assert.match(panel, /screenAsksBeforeCharge/);
  assert.match(panel, /onOpenScreen\(row\.computer_id, label, row\.screen_credits_per_hour/);
  assert.match(shell, /onOpenScreen=\{openCloudScreen\}/);
  assert.match(shell, /active \|\| activeDock\.kind === "computer"/);
});

test("a charged pause shows as 暂停 instead of 空闲", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /paused: "暂停"/);
  assert.match(panel, /pausedAt: "暂停 \{rate\} 星币\/小时"/);
  assert.match(panel, /runningAt: "开着 \{rate\} 星币\/小时"/);
  assert.match(panel, /computerStatusLine\(row, t\)/);
});

test("a billed pause prints the hourly disk price on the status line", () => {
  const labels = {
    idle: "空闲",
    paused: "暂停",
    running: "开着",
    files: "已有文件",
    emptyDisk: "还没有文件",
    pausedAt: "暂停 {rate} 星币/小时",
    runningAt: "开着 {rate} 星币/小时",
  };
  assert.equal(
    computerStatusLine({ status: "paused", has_disk: true, paused_credits_per_hour: 11 }, labels),
    "暂停 11 星币/小时 · 已有文件",
  );
  assert.equal(
    computerStatusLine({ status: "idle", has_disk: true, paused_credits_per_hour: 0 }, labels),
    "空闲 · 已有文件",
  );
  assert.equal(
    computerStatusLine(
      { status: "running", has_disk: true, resume_credits_per_hour: 58, paused_credits_per_hour: 11 },
      labels,
    ),
    "开着 58 星币/小时 · 已有文件",
  );
});

test("a running computer can be paused from the panel", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /pause: "暂停"/);
  assert.match(panel, /pauseAt: "暂停 · \{rate\} 星币\/小时"/);
  assert.match(panel, /\/api\/computers\/\$\{encodeURIComponent\(computerId\)\}\/pause/);
  assert.match(panel, /row\.status === "running"/);
  assert.match(panel, /pauseAsksBeforeCharge\(row\.paused_credits_per_hour\) &&/);
  assert.match(panel, /withRate\(t\.pauseAt, row\.paused_credits_per_hour\)/);
});

test("pause asks before a charged pause and skips a free one", () => {
  assert.equal(pauseAsksBeforeCharge(5), true);
  assert.equal(pauseAsksBeforeCharge(0), false);
  assert.equal(pauseAsksBeforeCharge(undefined), false);
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /pauseAsksBeforeCharge\(row\.paused_credits_per_hour\)/);
  assert.match(panel, /pauseConfirm: "暂停后按 \{rate\} 星币\/小时计费/);
  assert.match(panel, /kind: "pause"/);
});

test("an idle computer with a disk can be resumed from the panel", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /resume: "恢复"/);
  assert.match(panel, /resumeAt: "恢复 · \{rate\} 星币\/小时"/);
  assert.match(panel, /\/api\/computers\/\$\{encodeURIComponent\(computerId\)\}\/resume/);
  assert.match(panel, /row\.has_disk \? \(/);
  assert.match(panel, /withRate\(t\.resumeAt, row\.resume_credits_per_hour\)/);
});

test("resuming asks on the panel before it starts billing", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /ConfirmDialog/);
  assert.match(panel, /resumeConfirm: "恢复按 \{rate\} 星币\/小时计费/);
  assert.doesNotMatch(panel, /kind: "screen"/);
  assert.doesNotMatch(
    panel,
    /onClick=\{\(\) => void resumeThis\(row\.computer_id\)\}/,
  );
});

test("opening another computer asks on the panel first", () => {
  assert.equal(extraAsksBeforeCreate(0), false);
  assert.equal(extraAsksBeforeCreate(1), true);
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /extraAsksBeforeCreate\(computers\.length\)/);
  assert.match(panel, /kind: "extra"/);
  assert.match(panel, /extraConfirm: "再开一台免费/);
  assert.doesNotMatch(
    panel,
    /<button type="button" disabled=\{busy\} onClick=\{\(\) => void openAnother\(\)\}>/,
  );
});

test("every screen path asks in the shell before the hourly bill starts", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const i18n = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  assert.match(shell, /setConfirmDialog\(\{/);
  assert.match(shell, /t\.screenConfirm\.replace/);
  assert.match(shell, /screenAsksBeforeCharge/);
  assert.match(shell, /onOpenComputer=\{openCloudScreen\}/);
  assert.match(shell, /onOpenScreen=\{openCloudScreen\}/);
  assert.match(shell, /openCloudScreen\(id, label, rate, hint\)/);
  assert.match(i18n, /screenConfirm: "打开电脑屏幕按 \{rate\} 星币\/小时计费/);
  assert.match(i18n, /openScreen: "打开电脑屏幕"/);
  assert.match(panel, /onOpenScreen\(row\.computer_id, label, row\.screen_credits_per_hour/);
  assert.doesNotMatch(panel, /kind: "screen"/);
});

test("a billed confirm button prints the hourly rate", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const i18n = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  assert.match(panel, /withRate\(t\.pauseAt, pending\.rate\)/);
  assert.match(panel, /withRate\(t\.resumeAt, pending\.rate\)/);
  assert.match(i18n, /openScreenAt: "打开电脑屏幕 · \{rate\} 星币\/小时"/);
  assert.match(i18n, /sendAt: "发送 · \{rate\} 星币\/小时"/);
  assert.match(shell, /t\.openScreenAt\.replace\("\{rate\}", String\(billed\)\)/);
  assert.match(shell, /t\.sendAt\.replace\("\{rate\}", String\(rate\)\)/);
});

test("an open billed screen prints the hourly rate on the dock tab", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const i18n = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  assert.match(i18n, /screenDock: "\{label\} · \{rate\} 星币\/小时"/);
  assert.match(i18n, /screenDock: "\{label\} · \{rate\}\/hr"/);
  assert.match(
    shell,
    /t\.screenDock\.replace\("\{label\}", label\)\.replace\("\{rate\}", String\(billed\)\)/,
  );
  assert.match(shell, /kind: "computer", title \}/);
});
