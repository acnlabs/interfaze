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
const { screenLiveTicketExp, screenLiveNeedsRefresh } = moduleExports;

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
