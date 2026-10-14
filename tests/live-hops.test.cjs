const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(rel, requireMap) {
  const source = fs.readFileSync(path.join(__dirname, rel), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (requireMap && requireMap[id]) return requireMap[id];
    throw new Error(`unexpected import ${id}`);
  };
  new Function("exports", "require", "module", js)(module.exports, localRequire, module);
  return module.exports;
}

const orchestration = load("../packages/agent-chat/src/orchestration.ts");
const { foldLiveHops, parseHopUpdate } = load("../packages/agent-chat/src/liveHops.ts", {
  "./orchestration": orchestration,
});

function agentMessage(sender, callees) {
  return { sender_type: "agent", sender_id: sender, metadata: { orchestration: { callees } } };
}

test("direct chat keeps an outside callee and drops the human", () => {
  const hops = foldLiveHops(
    [
      { sender_type: "user", sender_id: "me", metadata: { orchestration: { callees: [{ agent_id: "board" }] } } },
      agentMessage("writer", [{ agent_id: "acn:board", name: "分镜", hop_id: "hop:invoke:board" }]),
    ],
    [],
  );
  assert.deepEqual(
    hops.map((hop) => [hop.fromId, hop.toId, hop.phase, hop.name]),
    [["writer", "board", "completed", "分镜"]],
  );
});

test("group chat keeps two calls and a failure", () => {
  const hops = foldLiveHops(
    [
      agentMessage("writer", [
        { agent_id: "board", status: "sent", hop_id: "hop:invoke:board" },
        { agent_id: "editor", status: "failed", hop_id: "hop:invoke:editor" },
      ]),
    ],
    [],
  );
  assert.equal(hops.length, 2);
  assert.equal(hops[0].phase, "in_flight");
  assert.equal(hops[1].phase, "failed");
});

test("missing status counts as returned", () => {
  const hops = foldLiveHops([agentMessage("writer", [{ agent_id: "board" }])], []);
  assert.equal(hops[0].phase, "completed");
});

test("a finished hop does not return to in-flight", () => {
  const hops = foldLiveHops(
    [agentMessage("writer", [{ agent_id: "board", status: "completed", hop_id: "hop:invoke:board" }])],
    [{ hopId: "hop:invoke:board", fromId: "writer", toId: "board", phase: "in_flight", name: null }],
  );
  assert.equal(hops[0].phase, "completed");
});

test("a later return replaces waiting", () => {
  const hops = foldLiveHops(
    [agentMessage("writer", [{ agent_id: "board", status: "accepted", hop_id: "hop:invoke:board" }])],
    [{ hopId: "hop:invoke:board", fromId: "writer", toId: "board", phase: "completed", name: "分镜" }],
  );
  assert.equal(hops[0].phase, "completed");
  assert.equal(hops[0].name, "分镜");
});

test("self calls and bad events are dropped", () => {
  const hops = foldLiveHops([agentMessage("writer", [{ agent_id: "writer", status: "sent" }])], []);
  assert.equal(hops.length, 0);
  assert.equal(parseHopUpdate({ hop_id: "nope", from_agent_id: "a", to_agent_id: "b", phase: "in_flight" }), null);
  assert.equal(
    parseHopUpdate({ hop_id: "hop:invoke:board", from_agent_id: "writer", to_agent_id: "board", phase: "working" }),
    null,
  );
  assert.equal(
    parseHopUpdate({
      hop_id: "hop:invoke:req:board",
      from_agent_id: "system:agent-router",
      to_agent_id: "board",
      phase: "in_flight",
    }),
    null,
  );
});
