const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, "../packages/agent-chat/src", file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function("exports", js)(exports);
  return exports;
}

const picker = load("agentPicker.ts");
const money = load("displayMoney.ts");

test("opaque ids are not shown as an agent description", () => {
  const id = "acn:11111111-2222-4333-8444-555555555555";
  assert.equal(picker.agentPickerSubtitle(id, id, "暂无简介"), "暂无简介");
  assert.equal(
    picker.agentPickerSubtitle(id, "11111111-2222-4333-8444-555555555555", "No description"),
    "No description",
  );
  assert.equal(picker.agentPickerSubtitle(id, "Helps with contracts", "暂无简介"), "Helps with contracts");
});

test("agents that refuse chat or work stay out of the picker", () => {
  assert.equal(picker.agentRefusesChat("Does not chat"), true);
  assert.equal(picker.agentRefusesChat("Does not execute work"), true);
  assert.equal(picker.agentRefusesChat("这个智能体不聊天"), true);
  assert.equal(picker.agentRefusesChat("Helps with contracts"), false);
});

test("prices keep at most four significant digits and a dollar sign", () => {
  assert.equal(money.formatUsdPerMillion(0.383333), "$0.3833");
  assert.equal(money.formatUsdPerMillion(1.53333), "$1.533");
  assert.equal(money.formatUsdPerMillion(0.291667), "$0.2917");
});
