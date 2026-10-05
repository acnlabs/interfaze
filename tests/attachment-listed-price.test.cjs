const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/attachmentListedPrice.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { attachmentListedPriceVisible } = moduleExports;

test("owner and unpaid hops do not show the credits badge", () => {
  assert.equal(attachmentListedPriceVisible(undefined), false);
  assert.equal(attachmentListedPriceVisible({ status: "skipped_p8", amount: 0 }), false);
  assert.equal(attachmentListedPriceVisible({ status: "skipped_no_sku", amount: 0 }), false);
  assert.equal(attachmentListedPriceVisible({ status: "skipped_insufficient", amount: 0 }), false);
  assert.equal(attachmentListedPriceVisible({ status: "captured", amount: 0 }), false);
  assert.equal(attachmentListedPriceVisible({ status: "held", amount: 0 }), false);
  assert.equal(attachmentListedPriceVisible({ status: "held", amount: 12 }), false);
});

test("a settled charge shows the badge", () => {
  assert.equal(attachmentListedPriceVisible({ status: "captured", amount: 12 }), true);
  assert.equal(attachmentListedPriceVisible({ status: "captured", amount: 36 }), true);
});

test("a later file is not covered by an earlier charge", () => {
  const piece = { status: "captured", amount: 12, billed_refs: ["file-a"] };
  assert.equal(moduleExports.attachmentFileBadgeVisible(piece, "file-a"), true);
  assert.equal(moduleExports.attachmentFileBadgeVisible(piece, "file-b"), false);
  assert.equal(moduleExports.attachmentSettledVisible(piece, ["file-b"]), false);
  assert.equal(moduleExports.attachmentSettledVisible(piece, ["file-a", "file-b"]), true);
  assert.equal(
    moduleExports.attachmentFileBadgeVisible({ status: "captured", amount: 12 }, "file-b"),
    true,
  );
});
