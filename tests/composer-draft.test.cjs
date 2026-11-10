const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../packages/agent-chat/src/composerDraft.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const {
  clearComposerUnsent,
  composerDraftAfterSend,
  composerDraftFromStore,
  composerDraftStorageKey,
  composerDraftToStore,
  pickInboxDraft,
  stepComposerRecall,
} = moduleExports;

test("an empty draft deletes the key and spaces stay", () => {
  assert.equal(composerDraftToStore(""), null);
  assert.equal(composerDraftToStore("  "), "  ");
  assert.equal(composerDraftToStore("hello"), "hello");
});

test("a stored draft round-trips, including spaces", () => {
  assert.equal(composerDraftFromStore(null), "");
  assert.equal(composerDraftFromStore("hello"), "hello");
  assert.equal(composerDraftFromStore("  "), "  ");
});

test("a successful send drops only the snapshot that was sent", () => {
  assert.equal(composerDraftAfterSend("hello", "hello"), "");
  assert.equal(composerDraftAfterSend("hello", "hello more"), "hello more");
  assert.equal(composerDraftAfterSend("hello", ""), "");
  assert.equal(composerDraftAfterSend("  hello", "  hello"), "");
});

test("each chat has its own key", () => {
  assert.equal(composerDraftStorageKey("abc"), "interfaze:composerDraft:abc");
  assert.notEqual(composerDraftStorageKey("abc"), composerDraftStorageKey("def"));
});

test("an inbox row shows a draft left on an older chat with the same agent", () => {
  const stored = { latest: "", older: "still here" };
  const picked = pickInboxDraft({
    chatIds: ["latest", "older"],
    openChatId: null,
    openDraft: "",
    stored: (id) => stored[id] ?? "",
    visible: (raw) => raw.trim(),
  });
  assert.deepEqual(picked, { chatId: "older", text: "still here" });
});

test("the open chat's unsent text wins over an older sibling", () => {
  const picked = pickInboxDraft({
    chatIds: ["latest", "older"],
    openChatId: "latest",
    openDraft: "typing now",
    stored: () => "older draft",
    visible: (raw) => raw.trim(),
  });
  assert.deepEqual(picked, { chatId: "latest", text: "typing now" });
});

test("logout drops unsent composer keys and keeps the model pick", () => {
  const kept = new Map([
    ["interfaze:composerDraft:chat-a", "hello"],
    ["interfaze:composerReply:chat-a", "{}"],
    ["interfaze:composerFiles:chat-a", "[]"],
    ["interfaze:stickyMention:chat-a", "{}"],
    ["interfaze:composerModel:chat-a", "deepseek-v4-flash"],
    ["interfaze:composerPrice:chat-a", "1"],
  ]);
  const keys = () => [...kept.keys()];
  clearComposerUnsent({
    get length() {
      return kept.size;
    },
    key(index) {
      return keys()[index] ?? null;
    },
    removeItem(key) {
      kept.delete(key);
    },
  });
  assert.deepEqual([...kept.keys()], [
    "interfaze:composerModel:chat-a",
    "interfaze:composerPrice:chat-a",
  ]);
});

test("a blank open chat does not hide a sibling draft, and spaces do not count", () => {
  const stored = { latest: "   ", older: "kept" };
  const picked = pickInboxDraft({
    chatIds: ["latest", "older"],
    openChatId: "latest",
    openDraft: "   ",
    stored: (id) => stored[id] ?? "",
    visible: (raw) => raw.trim(),
  });
  assert.deepEqual(picked, { chatId: "older", text: "kept" });
});

test("arrowing through your own messages stops at the ends", () => {
  assert.equal(stepComposerRecall(0, null, "older"), null);
  assert.equal(stepComposerRecall(3, null, "older"), 2);
  assert.equal(stepComposerRecall(3, 2, "older"), 1);
  assert.equal(stepComposerRecall(3, 0, "older"), 0);
  assert.equal(stepComposerRecall(3, 2, "newer"), null);
  assert.equal(stepComposerRecall(3, 1, "newer"), 2);
  assert.equal(stepComposerRecall(3, null, "newer"), null);
});
