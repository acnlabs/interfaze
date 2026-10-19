const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/inflight.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { createInflightGate } = moduleExports;

test("overlapping calls share one run, and the next call runs again", async () => {
  const gate = createInflightGate();
  let runs = 0;
  const first = gate.share(async () => {
    runs += 1;
    return "a";
  });
  const second = gate.share(async () => {
    runs += 1;
    return "b";
  });
  assert.equal(await first, "a");
  assert.equal(await second, "a");
  assert.equal(runs, 1);
  assert.equal(await gate.share(async () => {
    runs += 1;
    return "c";
  }), "c");
  assert.equal(runs, 2);
});

test("a failed call does not stick, so the retry runs", async () => {
  const gate = createInflightGate();
  await assert.rejects(gate.share(async () => {
    throw new Error("down");
  }));
  assert.equal(await gate.share(async () => "up"), "up");
});

test("fresh waits out the current run, then loads again", async () => {
  const gate = createInflightGate();
  let release;
  let runs = 0;
  const first = gate.share(() => new Promise((resolve) => {
    runs += 1;
    release = resolve;
  }));
  const second = gate.fresh(async () => {
    runs += 1;
    return "fresh";
  });
  assert.equal(runs, 1);
  release("old");
  assert.equal(await first, "old");
  assert.equal(await second, "fresh");
  assert.equal(runs, 2);
});
