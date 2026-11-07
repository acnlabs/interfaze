const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/composerModality.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { acceptsImageInput, mimeLooksLikeImage } = moduleExports;

test("OpenRouter modality with image input is accepted", () => {
  assert.equal(acceptsImageInput("text+image->text"), true);
});

test("OpenRouter text-only modality rejects images", () => {
  assert.equal(acceptsImageInput("text->text"), false);
});

test("bare TokenPlus text is unknown, not a hard no", () => {
  assert.equal(acceptsImageInput("text"), null);
  assert.equal(acceptsImageInput(null), null);
});

test("mimeLooksLikeImage", () => {
  assert.equal(mimeLooksLikeImage("image/png"), true);
  assert.equal(mimeLooksLikeImage("application/pdf"), false);
});
