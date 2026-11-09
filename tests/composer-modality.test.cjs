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
  dataTransferTypesIncludeFiles,
  fileLooksLikeImage,
  filesLookLikeImages,
  imageInputBlocked,
  mimeLooksLikeImage,
  modalityForSelectedModel,
  ownerFileTypeAllowed,
  filesFromDataTransfer,
  filesFromDroppedEntries,
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
  assert.equal(fileLooksLikeImage({ type: "", name: "shot.png" }), true);
  assert.equal(dataTransferTypesIncludeFiles(["Files"]), true);
  assert.equal(dataTransferTypesIncludeFiles(["text/plain"]), false);
});

test("a dropped folder becomes the files inside it", async () => {
  const png = new File(["x"], "shot.png", { type: "image/png" });
  const zip = new File(["x"], "pack.zip", { type: "application/zip" });
  const hidden = new File(["x"], ".DS_Store", { type: "" });
  const fileEntry = (file) => ({
    isFile: true,
    isDirectory: false,
    name: file.name,
    file: (ok) => ok(file),
  });
  const folder = {
    isFile: false,
    isDirectory: true,
    name: "album",
    createReader: () => {
      let listed = false;
      return {
        readEntries: (ok) => {
          if (listed) {
            ok([]);
            return;
          }
          listed = true;
          ok([fileEntry(png), fileEntry(zip), fileEntry(hidden)]);
        },
      };
    },
  };
  const walked = await filesFromDroppedEntries([folder]);
  assert.deepEqual(walked.map((file) => file.name), ["shot.png", "pack.zip"]);
  const dropped = await filesFromDataTransfer({
    files: [],
    items: [{ webkitGetAsEntry: () => folder }],
  });
  assert.equal(dropped.expandedDirectory, true);
  assert.deepEqual(dropped.files.map((file) => file.name), ["shot.png", "pack.zip"]);
  const plain = await filesFromDataTransfer({
    files: [png],
    items: [{ webkitGetAsEntry: () => fileEntry(png) }],
  });
  assert.equal(plain.expandedDirectory, false);
  assert.equal(plain.files[0], png);
});

test("owner uploads accept images, pdf, text, audio, and video", () => {
  assert.equal(ownerFileTypeAllowed({ type: "image/png", name: "a.png" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "application/pdf", name: "a.pdf" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "text/plain", name: "a.txt" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "audio/mpeg", name: "a.mp3" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "audio/mp4", name: "a.m4a" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "video/mp4", name: "a.mp4" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "video/webm", name: "a.webm" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "", name: "clip.wav" }), true);
  assert.equal(ownerFileTypeAllowed({ type: "application/zip", name: "a.zip" }), false);
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
