import assert from "node:assert/strict";
import {
  acceptsImageInput,
  dataTransferTypesIncludeFiles,
  fileLooksLikeImage,
  filesLookLikeImages,
  imageInputBlocked,
  mimeLooksLikeImage,
  modalityForSelectedModel,
} from "./composerModality";

assert.equal(acceptsImageInput("text+image->text"), true);
assert.equal(acceptsImageInput("text+image->image+text"), true);
assert.equal(acceptsImageInput("text->text"), false);
assert.equal(acceptsImageInput("text->image"), false);
assert.equal(acceptsImageInput("text"), null);
assert.equal(acceptsImageInput("text-only"), null);
assert.equal(acceptsImageInput(null), null);
assert.equal(acceptsImageInput(""), null);
assert.equal(acceptsImageInput("IMAGE"), true);

assert.equal(mimeLooksLikeImage("image/png"), true);
assert.equal(mimeLooksLikeImage("image/jpeg"), true);
assert.equal(mimeLooksLikeImage("application/pdf"), false);
assert.equal(mimeLooksLikeImage(null), false);
assert.equal(imageInputBlocked("text->text"), true);
assert.equal(imageInputBlocked("text+image->text"), false);
assert.equal(imageInputBlocked(null), false);
assert.equal(filesLookLikeImages([{ type: "image/png" }, { type: "text/plain" }]), true);
assert.equal(filesLookLikeImages([{ type: "application/pdf" }]), false);
assert.equal(fileLooksLikeImage({ type: "", name: "shot.PNG" }), true);
assert.equal(dataTransferTypesIncludeFiles(["Files"]), true);
assert.equal(dataTransferTypesIncludeFiles(["text/plain"]), false);

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
assert.equal(
  modalityForSelectedModel({
    useCatalog: false,
    modelId: "tencenttokenplan/kimi-k2.5",
    agentRows: [{ model_id: "tencenttokenplan/kimi-k2.5", modality: "text->text" }],
    catalogRows: [{ id: "tencenttokenplan/kimi-k2.5", modality: "text+image->text" }],
    sameShown: same,
    sameId: same,
  }),
  "text->text",
);
assert.equal(
  modalityForSelectedModel({
    useCatalog: true,
    modelId: "openai/gpt-4o",
    agentRows: [],
    catalogRows: [{ id: "openai/gpt-4o", modality: "text+image->text" }],
    sameShown: same,
    sameId: same,
  }),
  "text+image->text",
);

console.log("composerModality ok");
