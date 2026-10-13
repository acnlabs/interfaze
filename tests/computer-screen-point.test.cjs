const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/computerScreenPoint.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { screenPoint, screenFrameSize, screenLiveBox } = moduleExports;

test("a click maps onto the desktop", () => {
  assert.deepEqual(screenPoint(0, 0, 200, 150), { x: 0, y: 0 });
  assert.deepEqual(screenPoint(100, 75, 200, 150), { x: 512, y: 384 });
  assert.deepEqual(screenPoint(200, 150, 200, 150), { x: 1023, y: 767 });
});

test("a click outside the picture stays on the desktop", () => {
  assert.deepEqual(screenPoint(-10, 999, 200, 150), { x: 0, y: 767 });
  assert.equal(screenPoint(1, 1, 0, 150), null);
});

test("a 16:9 pane contains a 1024×768 live iframe", () => {
  assert.deepEqual(screenFrameSize(1600, 900), { width: 1200, height: 900, left: 200, top: 0 });
  assert.deepEqual(screenFrameSize(1920, 1080), { width: 1440, height: 1080, left: 240, top: 0 });
  assert.deepEqual(screenFrameSize(900, 900), { width: 900, height: 675, left: 0, top: 112 });
  assert.equal(screenFrameSize(0, 900), null);
});

test("china keeps the live iframe contained; overseas fills after a real fit", () => {
  assert.deepEqual(screenLiveBox({ width: 1600, height: 900 }, false), {
    left: 200,
    top: 0,
    width: 1200,
    height: 900,
  });
  assert.equal(screenLiveBox({ width: 1600, height: 900 }, true), null);
  assert.equal(screenLiveBox(null, false), null);
});

test("a fallback picture uses the same 1024×768 box so a click maps onto the desktop", () => {
  const box = screenLiveBox({ width: 1600, height: 900 }, false);
  assert.deepEqual(screenPoint(0, 0, box.width, box.height), { x: 0, y: 0 });
  assert.deepEqual(screenPoint(box.width, box.height, box.width, box.height), { x: 1023, y: 767 });
  const panel = fs.readFileSync(
    path.join(__dirname, "../packages/agent-chat/src/ComputerScreenPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /deskBox\(false\)/);
});
