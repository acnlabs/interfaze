const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync(path.join(__dirname, '../packages/agent-chat/src/HistoryFilesPanel.tsx'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function mount(chats, listChatFiles, initial = [{}, true, [], 0]) {
  const states = [...initial];
  let index = 0, effect, deps;
  const exports = {};
  new Function('exports', 'require', code)(exports, name => {
    if (name === 'react') return {
      useState() { const i = index++; return [states[i], value => {
        states[i] = typeof value === 'function' ? value(states[i]) : value;
      }]; },
      useEffect(fn, d) { effect = fn; deps = d; },
    };
    if (name === './ranch-shell/styles') return { colors: { muted: '#888', border: '#333', text: '#fff' } };
    if (name === './HistoryChatThumbs') return { HistoryChatThumbs: () => React.createElement('span', null, 'Files') };
    return require(name);
  });
  const view = exports.HistoryFilesPanel({ chats, listChatFiles, client: { listChatFiles },
    labelFor: chat => chat.chat_id, gatewayBaseUrl: 'https://example.com', getAccessToken: async () => null,
    emptyLabel: 'No attachments', loadingLabel: 'Loading', failedLabel: 'Load failed', retryLabel: 'Retry', onPick() {} });
  return { states, deps, view, html: renderToStaticMarkup(view), cleanup: effect() };
}
test('failed attachment listing remains distinct from a successful empty result', async () => {
  const view = mount([{ chat_id: 'a' }], async () => { throw new Error('network'); });
  await flush();
  assert.deepEqual(view.states[2], ['a']);
  assert.equal(view.states[1], false);
  const rendered = mount([{ chat_id: 'a' }], async () => [], view.states);
  assert.match(rendered.html, /role="alert"/);
  assert.match(rendered.html, /Retry/);
  assert.doesNotMatch(rendered.html, /No attachments/);
  view.cleanup(); rendered.cleanup();
});
test('a partial list keeps successful attachments alongside its error', async () => {
  const view = mount([{ chat_id: 'a' }, { chat_id: 'b' }], async id => {
    if (id === 'b') throw new Error('offline');
    return [{ attachment_id: 'file' }];
  });
  await flush();
  assert.equal(view.states[0].a.length, 1);
  assert.deepEqual(view.states[2], ['b']);
  view.cleanup();
});
test('cancelled old list cannot publish files, failures or loading state', async () => {
  let finish;
  const view = mount([{ chat_id: 'old' }], () => new Promise(resolve => { finish = resolve; }));
  view.cleanup(); finish([{ attachment_id: 'old-file' }]); await flush();
  assert.deepEqual(view.states[0], {});
  assert.deepEqual(view.states[2], []);
  assert.equal(view.states[1], true);
});
test('retry state is a real loading dependency and an empty chat list ends loading', () => {
  const view = mount([], () => assert.fail('must not load without chats'), [{}, true, ['old'], 2]);
  assert.equal(view.deps[2], 2);
  assert.equal(view.states[1], false);
  assert.deepEqual(view.states[2], []);
});
test('the rendered retry button reloads and a successful response clears the failure', async () => {
  const view = mount([{ chat_id: 'a' }], async () => { throw new Error('offline'); }, [{}, false, ['a'], 0]);
  const alert = view.view.props.children[0];
  const button = alert.props.children.find(child => child?.type === 'button');
  button.props.onClick();
  assert.equal(view.states[3], 1);
  view.cleanup();
  const retry = mount([{ chat_id: 'a' }], async () => [{ attachment_id: 'file' }], view.states);
  await flush();
  assert.deepEqual(retry.states[2], []);
  assert.equal(retry.states[1], false);
  assert.equal(retry.states[0].a.length, 1);
  retry.cleanup();
});
