const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relative) {
  const source = fs.readFileSync(path.join(__dirname, relative), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const moduleExports = {};
  new Function("exports", js)(moduleExports);
  return moduleExports;
}

const { groupRoster } = load("../packages/agent-chat/src/groupRoster.ts");
const { decideChipExpired } = load("../packages/agent-chat/src/orchestration.ts");

test("a group roster keeps the person and the agents", () => {
  const rows = groupRoster(
    [
      { participant_type: "agent", participant_id: "a1", name: "Comiclaw", is_active: true },
      { participant_type: "agent", participant_id: "a2", name: "Labs", is_active: true },
      { participant_type: "user", participant_id: "u1", name: "Neil", is_active: true },
      { participant_type: "agent", participant_id: "gone", is_active: false },
    ],
    { a1: "Comiclaw", a2: "Labs" },
    "你",
  );
  assert.deepEqual(rows.map((row) => row.kind), ["person", "agent", "agent"]);
  assert.equal(rows[0].name, "Neil");
  assert.equal(rows.find((row) => row.id === "gone"), undefined);
});

test("the signed-in person stays when the api only lists agents", () => {
  const rows = groupRoster(
    [
      { participant_type: "agent", participant_id: "a1", name: "Comiclaw", is_active: true },
      { participant_type: "agent", participant_id: "a2", name: "Labs", is_active: true },
    ],
    { a1: "Comiclaw", a2: "Labs" },
    "Neil",
  );
  assert.equal(rows[0].kind, "person");
  assert.equal(rows[0].name, "Neil");
  assert.equal(rows.length, 3);
});

test("a person without a name uses the signed-in name", () => {
  const rows = groupRoster(
    [{ participant_type: "user", participant_id: "u1", is_active: true }],
    {},
    "Neil",
  );
  assert.equal(rows[0].name, "Neil");
  assert.equal(rows[0].kind, "person");
});

test("an older decision is expired and the latest one stays open", () => {
  assert.equal(decideChipExpired("old", "latest"), true);
  assert.equal(decideChipExpired("latest", "latest"), false);
  assert.equal(decideChipExpired("only", undefined), false);
});
