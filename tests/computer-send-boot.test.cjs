const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/computerSendBoot.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { sendAsksBeforeBoot, placeForDefaultComputer } = moduleExports;

test("an idle cloud computer asks before a send starts the hourly bill", () => {
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "idle", computer_id: "pc" }, []),
    true,
  );
});

test("a running computer or an agent machine does not ask again", () => {
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "running", computer_id: "pc" }, []),
    false,
  );
  assert.equal(
    sendAsksBeforeBoot({ place: "agent", status: null, computer_id: null }, []),
    false,
  );
});

test("an open screen already asked, so send does not stack a second dialog", () => {
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "idle", computer_id: "pc" }, ["pc"]),
    false,
  );
});

test("the composer asks in the shell before an idle send starts billing", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const i18n = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  assert.match(shell, /sendAsksBeforeBoot/);
  assert.match(shell, /t\.sendConfirm\.replace/);
  assert.match(shell, /retryLastUserMessage[\s\S]*void send\(\{ text \}\)/);
  assert.match(i18n, /sendConfirm: "发送后电脑按 \{rate\} 星币\/小时计费/);
});

test("a new group lands on the idle default computer, so the digest asks first", () => {
  const place = placeForDefaultComputer([
    {
      computer_id: "extra",
      is_default: false,
      status: "running",
      resume_credits_per_hour: 18,
    },
    {
      computer_id: "home",
      is_default: true,
      status: "idle",
      resume_credits_per_hour: 18,
    },
  ]);
  assert.equal(place.computer_id, "home");
  assert.equal(sendAsksBeforeBoot(place, []), true);
  assert.equal(sendAsksBeforeBoot(place, ["home"]), false);
});

test("no computer yet still asks, because the first group digest would boot one", () => {
  const place = placeForDefaultComputer([]);
  assert.equal(place.place, "cloud");
  assert.equal(place.status, "idle");
  assert.equal(sendAsksBeforeBoot(place, []), true);
});

test("opening a proposed group asks before the digest can boot an idle computer", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  assert.match(shell, /placeForDefaultComputer/);
  assert.match(shell, /confirmProposeGroup[\s\S]*sendAsksBeforeBoot/);
  assert.match(shell, /bootAdmitted: true/);
});
