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
const { computerManageCta } = moduleExports;

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
  assert.match(panel, /screen: "打开屏幕"/);
  assert.match(panel, /onOpenScreen\(next\.computerId, next\.label\)/);
  assert.match(shell, /onOpenScreen=\{openCloudScreen\}/);
  assert.match(shell, /active \|\| activeDock\.kind === "computer"/);
});

test("a running computer can be paused from the panel", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /pause: "暂停"/);
  assert.match(panel, /\/api\/computers\/\$\{encodeURIComponent\(computerId\)\}\/pause/);
  assert.match(panel, /row\.status === "running"/);
});

test("an idle computer with a disk can be resumed from the panel", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /resume: "恢复"/);
  assert.match(panel, /\/api\/computers\/\$\{encodeURIComponent\(computerId\)\}\/resume/);
  assert.match(panel, /row\.has_disk \? \(/);
});

test("opening a screen or resuming asks before it starts billing", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerManagePanel.tsx"),
    "utf8",
  );
  assert.match(panel, /ConfirmDialog/);
  assert.match(panel, /resumeConfirm: "恢复按 \{rate\} 星币\/小时计费/);
  assert.match(panel, /screenConfirm: "打开屏幕按 \{rate\} 星币\/小时计费/);
  assert.match(panel, /kind: "screen"/);
  assert.match(panel, /kind: "resume"/);
  assert.doesNotMatch(panel, /onClick=\{\(\) => onOpenScreen\(row\.computer_id, label\)\}/);
  assert.doesNotMatch(
    panel,
    /onClick=\{\(\) => void resumeThis\(row\.computer_id\)\}/,
  );
});
