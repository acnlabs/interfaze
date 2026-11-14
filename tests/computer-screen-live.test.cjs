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
  screenStayAwake,
  screenSliceEnded,
  screenMinutesLeft,
  SCREEN_AWAY_PAUSE_MS,
  holdScreenAway,
  screenAwayHeld,
  releaseScreenAway,
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

test("a desktop without a ticket stays connected while the screen is up", () => {
  assert.equal(
    screenLiveNeedsRefresh(
      "https://6080-example.e2b.app/vnc.html?autoconnect=true&resize=scale&password=abc&reconnect=true",
    ),
    false,
  );
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

test("a fit result still says whether the desktop resized", () => {
  assert.equal(screenFitRemounts({ fitted: true }), true);
  assert.equal(screenFitRemounts({ fitted: false }), false);
});

test("the screen panel scales the desktop and does not ask it to resize", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /screenLiveBox\(pane, false\)/);
  assert.doesNotMatch(panel, /screen\/fit/);
  assert.doesNotMatch(panel, /width=\$\{/);
  assert.doesNotMatch(panel, /screenFitRemounts/);
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
  assert.match(panel, /opened\.status === 402/);
  assert.match(panel, /Computer time is unpaid/);
});

test("a hidden picture does not keep, and a finished half hour is not an unpaid bill", () => {
  assert.equal(SCREEN_AWAY_PAUSE_MS, 60_000);
  assert.equal(screenStayAwake("visible"), true);
  assert.equal(screenStayAwake("hidden"), false);
  assert.equal(screenSliceEnded(409, "screen slice ended"), true);
  assert.equal(screenSliceEnded(402, "cloud computer time is unpaid"), false);
  assert.equal(screenSliceEnded(409, "this computer has no screen"), false);
  assert.equal(screenMinutesLeft(1800, 1_000, 1_000), 30);
  assert.equal(screenMinutesLeft(1800, 1_000, 1_000 + 61_000), 29);
  assert.equal(screenMinutesLeft(30, 1_000, 1_000 + 30_000), 0);
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /screenStayAwake\(document\.visibilityState\)/);
  assert.match(panel, /armScreenPause\(/);
  assert.match(panel, /minutesLeft/);
  assert.match(panel, /holdScreenAway\(computerId\)/);
  assert.match(panel, /screenAwayHeld\(computerId\)/);
  assert.match(panel, /onRequestOpen\(run\)/);
});

test("coming back after a pause does not keep the screen awake", () => {
  releaseScreenAway("pc-away");
  assert.equal(screenAwayHeld("pc-away"), false);
  holdScreenAway("pc-away");
  assert.equal(screenAwayHeld("pc-away"), true);
  releaseScreenAway("pc-away");
  assert.equal(screenAwayHeld("pc-away"), false);
});
