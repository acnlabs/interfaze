const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync(path.join(__dirname, '../packages/agent-chat/src/MailboxThumbs.tsx'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
function render(files = [], failed = [], extra = {}) {
  const { statuses = {}, ...props } = extra;
  const states = [files, failed, 0, statuses];
  const exports = {};
  new Function('exports', 'require', js)(exports, name => {
    if (name === 'react') return { useEffect() {}, useState: () => [states.shift(), () => {}] };
    if (name === './mailbox') return {
      parseMessageAttachments: value => value,
      mailboxIdsFromAttachments: refs => refs.map(ref => ref.slice(4)),
      isReadableAttachmentName: () => true,
    };
    if (name === './ranch-shell/styles') return { colors: { muted: '#888', border: '#333' } };
    if (name === './SignedAttachmentLink') return { SignedAttachmentLink: ({ name, label, saveAsBlob }) => React.createElement('button', { 'data-save-as-blob': saveAsBlob || undefined }, label || name) };
    return require(name);
  });
  return renderToStaticMarkup(React.createElement(exports.MailboxThumbs, {
    chatId: 'chat', attachments: ['mbx:file'], gatewayBaseUrl: 'https://example.com',
    getAccessToken: async () => null, ...props,
  }));
}
const file = { mailboxId: 'file', name: 'tiny.mp4', contentType: 'video/mp4',
  url: 'https://example.com/file', listedCredits: 12, byteSize: 1024 };
test('attachment loading is visible and localized; no chat does not leave a spinner', () => {
  assert.match(render([], [], { loadingLabel: '正在加载附件' }), /role="status".*正在加载附件/);
  assert.equal(render([], [], { chatId: '' }), '');
});
test('small video has accessible full-width controls and a separate price header', () => {
  const html = render([file], [], { showListedPrice: true, chargedMailboxIds: ['file'] });
  assert.match(html, /min-height:160px/);
  assert.match(html, /aria-label="tiny.mp4"/);
  assert.match(html, /1.0 KB/);
  assert.ok(html.indexOf('12 Credits') < html.indexOf('<video'));
  assert.doesNotMatch(html, /position:absolute/);
  assert.doesNotMatch(render([file], [], { showListedPrice: true, chargedMailboxIds: ['other'] }), /12 Credits/);
});
test('failed media is replaced with its name and retry, not a broken player', () => {
  const html = render([file], ['file'], { retryLabel: '重试' });
  assert.match(html, /tiny.mp4/);
  assert.match(html, /重试/);
  assert.doesNotMatch(html, /<video/);
  assert.match(html, /min-height:44px/);
});

test('long media names can shrink without hiding the settled price header', () => {
  const longName = 'very-long-file-name-'.repeat(12) + '.mp4';
  const html = render([{ ...file, name: longName }], [], { showListedPrice: true });
  assert.match(html, /min-width:0/);
  assert.match(html, /text-overflow:ellipsis/);
  assert.ok(html.includes(`title="${longName}"`));
  assert.match(html, /12 Credits/);
});

test('mixed free and paid attachments only show one paid badge', () => {
  const html = render([file, { ...file, mailboxId: 'free', url: 'https://example.com/free', listedCredits: 0 }], [], {
    attachments: ['mbx:file', 'mbx:free'], showListedPrice: true, chargedMailboxIds: ['file'],
  });
  assert.equal((html.match(/12 Credits/g) || []).length, 1);
  assert.equal((html.match(/<video/g) || []).length, 2);
});

test('not-found, denied and network failures use distinct supplied labels', () => {
  for (const [status, label] of [[404, 'Unavailable'], [410, 'Unavailable'], [403, 'Denied'], [503, 'Load failed']]) {
    const html = render([], ['file'], { statuses: { file: status }, unavailableLabel: 'Unavailable',
      accessDeniedLabel: 'Denied', loadFailedLabel: 'Load failed' });
    assert.ok(html.includes(label));
    assert.ok(html.includes(`data-http-status="${status}"`));
    assert.doesNotMatch(html, /role="status"/);
  }
});
test('remote media exposes an explicit blob-download action, not only the native media menu', () => {
  const html = render([{ ...file, remote: true }], [], { downloadLabel: '下载' });
  assert.match(html, /data-save-as-blob="true">下载/);
  assert.match(html, /<video/);
});
