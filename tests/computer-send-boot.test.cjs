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
const {
  sendAsksBeforeBoot,
  sendNeedsDesk,
  placeForDefaultComputer,
  screenAsksBeforeCharge,
} = moduleExports;

test("a plain chat send does not ask just because the computer is idle", () => {
  assert.equal(sendNeedsDesk("hi"), false);
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "idle", computer_id: "pc" }, []),
    false,
  );
});

test("copying a mailbox file onto an idle computer still asks before the hourly bill", () => {
  assert.equal(sendNeedsDesk("see mbx:abc"), true);
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "idle", computer_id: "pc" }, [], true),
    true,
  );
});

test("copying a mailbox file onto a paused computer asks before the hourly bill", () => {
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "paused", computer_id: "pc" }, [], true),
    true,
  );
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "paused", computer_id: "pc" }, []),
    false,
  );
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "paused", computer_id: "pc" }, ["pc"], true),
    false,
  );
});

test("a running computer or an agent machine does not ask again", () => {
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "running", computer_id: "pc" }, [], true),
    false,
  );
  assert.equal(
    sendAsksBeforeBoot({ place: "agent", status: null, computer_id: null }, [], true),
    false,
  );
});

test("an open screen already asked, so send does not stack a second dialog", () => {
  assert.equal(
    sendAsksBeforeBoot({ place: "cloud", status: "idle", computer_id: "pc" }, ["pc"], true),
    false,
  );
});

test("the composer asks only when this send copies a file onto the desk", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const i18n = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  assert.match(shell, /sendAsksBeforeBoot\(place, bootScreenIds\(\), sendNeedsDesk\(text\)\)/);
  assert.match(shell, /t\.sendConfirm\.replace/);
  assert.match(shell, /retryLastUserMessage[\s\S]*void send\(\{ text \}\)/);
  assert.match(i18n, /sendConfirm: "发送后电脑按 \{rate\} 星币\/小时计费/);
  assert.match(shell, /onPlace=\{setChatPlace\}/);
  assert.match(
    shell,
    /sendAsksBeforeBoot\(chatPlace, bootScreenIds\(\), sendNeedsDesk\(draft\)\)/,
  );
  assert.match(
    shell,
    /t\.sendAt\.replace\("\{rate\}", String\(chatPlace\.resume_credits_per_hour\)\)/,
  );
});

test("a new group lands on the idle default computer, but a text digest does not ask", () => {
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
  assert.equal(sendAsksBeforeBoot(place, []), false);
  assert.equal(sendAsksBeforeBoot(place, [], true), true);
  assert.equal(sendAsksBeforeBoot(place, ["home"], true), false);
});

test("no computer yet does not ask for a text send", () => {
  const place = placeForDefaultComputer([]);
  assert.equal(place.place, "cloud");
  assert.equal(place.status, "idle");
  assert.equal(sendAsksBeforeBoot(place, []), false);
});

test("opening a proposed group asks only when that digest copies onto the desk", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx"),
    "utf8",
  );
  const i18n = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ranch-shell/i18n.ts"),
    "utf8",
  );
  assert.match(shell, /placeForDefaultComputer/);
  assert.match(shell, /confirmProposeGroup[\s\S]*sendNeedsDesk\(summary\)/);
  assert.match(shell, /bootAdmitted: true/);
  assert.match(i18n, /orchProposeCreateAt: "创建群聊 · \{rate\} 星币\/小时"/);
  assert.match(i18n, /orchProposeOpenExistingAt: "打开已有群 · \{rate\} 星币\/小时"/);
  assert.match(shell, /verbAt\.replace\("\{rate\}", String\(rate\)\)/);
});

test("an embed send asks only when this bubble copies a file onto the desk", () => {
  const embed = fs.readFileSync(
    path.join(__dirname, "../src/components/InterfazeEmbedHost.tsx"),
    "utf8",
  );
  assert.match(embed, /sendAsksBeforeBoot\(place, \[\], sendNeedsDesk\(text\)\)/);
  assert.match(embed, /rates\.sendConfirm\.replace/);
  assert.match(embed, /bootAdmitted: true/);
  assert.match(embed, /hourlyCreditCopy\(zh \? "zh" : "en", isCnRegion\(\)\)/);
  assert.match(embed, /confirmLabel:[\s\S]*rates\.sendAt\.replace/);
});

test("opening a screen asks when the machine is idle or paused", () => {
  assert.equal(
    screenAsksBeforeCharge({ status: "idle", resumeCreditsPerHour: 58, screenCreditsPerHour: 58 }),
    true,
  );
  assert.equal(
    screenAsksBeforeCharge({ status: "paused", resumeCreditsPerHour: 5, screenCreditsPerHour: 58 }),
    true,
  );
});

test("a running China computer does not ask again at the same hourly rate", () => {
  assert.equal(
    screenAsksBeforeCharge({
      status: "running",
      resumeCreditsPerHour: 58,
      screenCreditsPerHour: 58,
    }),
    false,
  );
});

test("the header screen button uses the chat place rates when the list has not loaded", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ChatComputerControl.tsx"),
    "utf8",
  );
  assert.match(panel, /row\?\.screen_credits_per_hour \?\? place\.screen_credits_per_hour/);
  assert.match(panel, /row\?\.status \?\? place\.status/);
  assert.match(panel, /row\?\.resume_credits_per_hour \?\? place\.resume_credits_per_hour/);
  assert.match(panel, /screenAsksBeforeCharge/);
  assert.match(panel, /hourlyCreditCopy\(locale, cn\)\.screenAt/);
  assert.match(panel, /asks \? caption : null/);
});

test("opening a screen asks when it would raise the hourly rate", () => {
  assert.equal(
    screenAsksBeforeCharge({
      status: "running",
      resumeCreditsPerHour: 18,
      screenCreditsPerHour: 85,
    }),
    true,
  );
  assert.equal(
    screenAsksBeforeCharge({
      status: "running",
      resumeCreditsPerHour: 58,
      screenCreditsPerHour: 115,
    }),
    true,
  );
});

test("the Labs assistant asks only when this send copies a file onto the desk", () => {
  const shell = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/AgentChatShell.tsx"),
    "utf8",
  );
  assert.match(shell, /sendAsksBeforeBoot\(place, \[\], sendNeedsDesk\(text\)\)/);
  assert.match(shell, /bootAdmitted: true/);
  assert.match(shell, /hourlyCreditCopy\(\s*isAssistant \? "zh" : "en",\s*isCnInterfazeOrigin\(resolveInterfazeOrigin\(\)\)/);
  assert.match(shell, /confirmLabel=\{confirmDialog\.confirmLabel\}/);
});
