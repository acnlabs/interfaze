import assert from "node:assert/strict";
import { acceptsImageInput, mimeLooksLikeImage } from "./composerModality";

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

console.log("composerModality ok");
