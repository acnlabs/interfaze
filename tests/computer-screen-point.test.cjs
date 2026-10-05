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
const { screenPoint } = moduleExports;

test("a click maps onto the desktop", () => {
  assert.deepEqual(screenPoint(0, 0, 200, 150), { x: 0, y: 0 });
  assert.deepEqual(screenPoint(100, 75, 200, 150), { x: 512, y: 384 });
  assert.deepEqual(screenPoint(200, 150, 200, 150), { x: 1023, y: 767 });
});

test("a click outside the picture stays on the desktop", () => {
  assert.deepEqual(screenPoint(-10, 999, 200, 150), { x: 0, y: 767 });
  assert.equal(screenPoint(1, 1, 0, 150), null);
});
