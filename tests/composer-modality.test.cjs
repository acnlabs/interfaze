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
const {
  acceptsImageInput,
  filesLookLikeImages,
  imageInputBlocked,
  mimeLooksLikeImage,
  modalityForSelectedModel,
} = moduleExports;

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

test("text-only modality blocks image attach; unknown does not", () => {
  assert.equal(imageInputBlocked("text->text"), true);
  assert.equal(imageInputBlocked(null), false);
  assert.equal(filesLookLikeImages([{ type: "image/jpeg" }]), true);
});

test("BYO reads agent modality and ignores catalog", () => {
  const same = (a, b) => a === b;
  assert.equal(
    modalityForSelectedModel({
      useCatalog: false,
      modelId: "vendor/m",
      agentRows: [{ model_id: "vendor/m", modality: "text->text" }],
      catalogRows: [{ id: "vendor/m", modality: "text+image->text" }],
      sameShown: same,
      sameId: same,
    }),
    "text->text",
  );
});
