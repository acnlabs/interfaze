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

const {
  applyReadHolds,
  beginReadHold,
  chatIdsToMarkRead,
  chatMatchesSearch,
  avatarBackground,
  avatarGlyph,
  avatarHue,
  conversationDisplayName,
  finishReadHold,
  historyConversationName,
  hostChannelLabel,
  withDistinctNames,
} = load("../packages/agent-chat/src/inboxList.ts");

const fallback = { untitled: "未命名对话", fresh: "新对话" };

test("history keeps each conversation's own headline", () => {
  const chat = {
    chat_id: "c1",
    title: "Comiclaw",
    embed: { headline: "ping-p8-owner-probe 1204" },
    last_message_at: "2026-10-16T00:00:00Z",
  };
  assert.equal(conversationDisplayName(chat, fallback), "Comiclaw");
  assert.equal(historyConversationName(chat, fallback), "ping-p8-owner-probe 1204");
});

test("a headline is the name only when the chat has no title", () => {
  const chat = {
    chat_id: "c1",
    embed: { headline: "ping-p8-owner-probe 1204" },
    last_message_at: "2026-10-16T00:00:00Z",
  };
  assert.equal(conversationDisplayName(chat, fallback), "ping-p8-owner-probe 1204");
});

test("same-name avatars use the short id and a stable color", () => {
  assert.equal(avatarGlyph("Comiclaw"), "C");
  assert.equal(avatarGlyph("Comiclaw · cd7ec18a"), "CD");
  assert.equal(avatarGlyph("Comiclaw · aa11bb22"), "AA");
  assert.notEqual(avatarHue("cd7ec18a-1111"), avatarHue("aa11bb22-2222"));
  assert.equal(avatarHue("Cd7ec18a-1111"), avatarHue("cd7ec18a-1111"));
  assert.match(avatarBackground("cd7ec18a-1111"), /^linear-gradient\(135deg, hsl\(/);
  assert.equal(avatarBackground("  "), "");
});

test("two chats with the same name keep a short id", () => {
  const rows = withDistinctNames(
    [
      { chat_id: "c1", title: "Comiclaw", agent_id: "acn:cd7ec18a-1111" },
      { chat_id: "c2", title: "Comiclaw", agent_id: "acn:aa11bb22-2222" },
    ],
    fallback,
    (row) => row.agent_id.replace(/^acn:/, "").slice(0, 8),
  );
  assert.equal(rows[0].displayName, "Comiclaw · cd7ec18a");
  assert.equal(rows[1].displayName, "Comiclaw · aa11bb22");
});

test("search matches the last message, not only the title", () => {
  const chat = {
    chat_id: "g1",
    type: "group",
    title: "Agent group",
    last_message_content: "Smoke test received",
  };
  assert.equal(chatMatchesSearch(chat, "smoke", fallback), true);
  assert.equal(chatMatchesSearch(chat, "relay", fallback), false);
  assert.equal(
    chatMatchesSearch({ ...chat, last_message_content: "Relay says hi" }, "Relay", fallback),
    true,
  );
});

test("a local embed origin is shown as Studio", () => {
  assert.equal(hostChannelLabel("http://127.0.0.1:3000"), "Studio");
  assert.equal(hostChannelLabel("127.0.0.1:3000"), "Studio");
  assert.equal(hostChannelLabel("http://localhost:3010/chat"), "Studio");
  assert.equal(hostChannelLabel("https://interfaze.io"), "interfaze.io");
  assert.equal(hostChannelLabel(""), "");
});

test("a read hold ignores the list already in flight, then trusts a later one", () => {
  const opened = { chat_id: "new", agent_id: "acn:same", unread_count: 0 };
  const all = [
    opened,
    { chat_id: "old", agent_id: "acn:same", unread_count: 1 },
    { chat_id: "other", agent_id: "acn:else", unread_count: 2 },
  ];
  assert.deepEqual(chatIdsToMarkRead(opened, all).sort(), ["new", "old"]);
  const holds = new Map();
  beginReadHold(holds, ["new", "old"], 1);
  finishReadHold(holds, ["new", "old"], 1, 100);
  const stale = applyReadHolds(
    all.map((row) => ({ ...row })),
    holds,
    50,
  );
  assert.equal(stale.find((row) => row.chat_id === "old").unread_count, 0);
  assert.equal(holds.has("old"), true);
  const arrived = applyReadHolds(
    [{ chat_id: "old", unread_count: 1 }, { chat_id: "other", unread_count: 2 }],
    holds,
    100,
  );
  assert.equal(arrived.find((row) => row.chat_id === "old").unread_count, 1);
  assert.equal(holds.has("old"), false);
  assert.equal(arrived.find((row) => row.chat_id === "other").unread_count, 2);
});
