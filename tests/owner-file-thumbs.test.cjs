const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, stubs) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  new Function("exports", "require", js)(exports, (name) => {
    if (stubs[name]) return stubs[name];
    return require(name);
  });
  return exports;
}

const mailbox = load("packages/agent-chat/src/mailbox.ts", {});

test("owner refs stay off the mailbox list and ignore unsafe ids", () => {
  const refs = [
    "upl:11111111-1111-1111-1111-111111111111",
    "mbx:mailbox-file",
    "upl:../secret",
    "upl:a/b",
    "  upl:ok-id  ",
  ];
  assert.deepEqual(mailbox.ownerIdsFromAttachments(refs), [
    "11111111-1111-1111-1111-111111111111",
    "ok-id",
  ]);
  assert.deepEqual(mailbox.mailboxIdsFromAttachments(refs), ["mailbox-file"]);
});

test("a sent owner image renders without a listed price", () => {
  const file = {
    id: "pic",
    name: "probe-magenta.png",
    contentType: "image/png",
    url: "blob:probe",
    remote: false,
    byteSize: 1751,
  };
  const states = [[file], [], 0, {}];
  const thumbs = load("packages/agent-chat/src/OwnerFileThumbs.tsx", {
    react: { useEffect() {}, useState: () => [states.shift(), () => {}] },
    "./mailbox": {
      parseMessageAttachments: (value) => value,
      ownerIdsFromAttachments: () => ["pic"],
    },
    "./ranch-shell/styles": { colors: { muted: "#888", border: "#333" } },
    "./SignedAttachmentLink": { SignedAttachmentLink: () => null },
  });
  const html = renderToStaticMarkup(
    React.createElement(thumbs.OwnerFileThumbs, {
      chatId: "chat",
      attachments: ["upl:pic"],
      gatewayBaseUrl: "https://example.com",
      getAccessToken: async () => null,
      downloadLabel: "下载",
    }),
  );
  assert.match(html, /alt="probe-magenta\.png"/);
  assert.match(html, /data-owner-file-id="pic"/);
  assert.match(html, /下载/);
  assert.doesNotMatch(html, /Credits|listed/i);
});
