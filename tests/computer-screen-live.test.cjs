const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/computerScreenLive.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const {
  screenLiveTicketExp,
  screenLiveNeedsRefresh,
  screenFitRemounts,
  screenStreamRetries,
} = moduleExports;

function liveUrl(exp) {
  return `https://api.acnlabs.cn/api/computers/pc/screen/live/view?ticket=${exp}.abc&password=x`;
}

test("a live url exposes the ticket expiry", () => {
  assert.equal(screenLiveTicketExp(liveUrl(1_800_000_000)), 1_800_000_000);
  assert.equal(screenLiveTicketExp("https://api.acnlabs.cn/api/computers/pc/screen/live/view"), null);
});

test("a fresh ticket does not refresh the iframe", () => {
  assert.equal(screenLiveNeedsRefresh(liveUrl(1_800_000_000), 1_800_000_000 - 600), false);
});

test("a ticket with five minutes left asks for a new live url", () => {
  assert.equal(screenLiveNeedsRefresh(liveUrl(1_800_000_000), 1_800_000_000 - 300), true);
  assert.equal(screenLiveNeedsRefresh(liveUrl(1_800_000_000), 1_800_000_000 + 1), true);
});

test("the screen panel refreshes the live url before the ticket dies", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /screenLiveNeedsRefresh/);
  assert.match(panel, /screen\/keep/);
  assert.match(panel, /keptBody\.screen !== false && !screenLiveNeedsRefresh\(live\)/);
});

test("a china no-op fit does not remount the live iframe", () => {
  assert.equal(screenFitRemounts({ fitted: true }), true);
  assert.equal(screenFitRemounts({ fitted: false }), false);
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /screenFitRemounts\(body\)/);
});

test("a china no-op fit keeps the live iframe at 1024×768 inside the pane", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /screenLiveBox\(pane, fillPane\)/);
  assert.match(panel, /setFillPane\(fitted\)/);
  assert.match(panel, /const fitted = screenFitRemounts\(body\)/);
});

test("a stream 503 retries once and a screen POST does not", () => {
  assert.equal(screenStreamRetries(503, 0), true);
  assert.equal(screenStreamRetries(503, 1), false);
  assert.equal(screenStreamRetries(409, 0), false);
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /streamScreen\(/);
  assert.match(panel, /screenStreamRetries\(first\.status, 0\)/);
  assert.match(panel, /method: "POST"/);
});
