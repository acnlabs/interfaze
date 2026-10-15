const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx'), 'utf8');
const start = source.indexOf('  useEffect(() => {\n    if (showMembersPanel) return;');
const end = source.indexOf('  const reloadMessages =', start);
assert.ok(start >= 0 && end > start);
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function mount(load) {
  let cleanup, error, updates = 0;
  const pending = { current: 'file' };
  const activeId = { current: 'chat' };
  const run = new Function('useEffect', 'showMembersPanel', 'pendingMailboxRef', 'active', 'messages',
    'messageIdForMailbox', 'window', 'scrollToMailbox', 'loadOlderUntilMailbox', 'setMessages',
    'mergeServerMessagesWithLocalTopicMarkers', 'activeChatIdRef', 'setError', 't', code);
  run(fn => { cleanup = fn(); }, false, pending, { chat_id: 'chat' }, [{ message_id: 'old' }],
    msgs => msgs.some(m => m.attachment === 'file') ? 'found' : null,
    { setTimeout: fn => { fn(); return 1; }, clearTimeout() {} }, () => {}, load,
    () => updates++, next => next, activeId, value => { error = value; },
    { attachmentUnavailable: 'Unavailable', messagesLoadFailed: 'Load failed' });
  return { cleanup, pending, activeId, error: () => error, updates: () => updates };
}
test('history attachment load rejection is handled and shows retry guidance', async () => {
  const view = mount(async () => { throw new Error('Failed to fetch'); });
  await flush();
  assert.equal(view.error(), 'Load failed');
  assert.equal(view.pending.current, null);
  assert.equal(view.updates(), 0);
  view.cleanup();
});
test('loading older messages retains the target through cleanup until a rendered scroll succeeds', async () => {
  const next = [{ message_id: 'found', attachment: 'file' }];
  const loading = mount(async () => next);
  await flush();
  assert.equal(loading.updates(), 1);
  assert.equal(loading.pending.current, 'file');
  loading.cleanup();
  assert.equal(loading.pending.current, 'file');

  let complete;
  let cleanup, scrolls = 0;
  const run = new Function('useEffect', 'showMembersPanel', 'pendingMailboxRef', 'active', 'messages',
    'messageIdForMailbox', 'window', 'scrollToMailbox', 'loadOlderUntilMailbox', 'setMessages',
    'mergeServerMessagesWithLocalTopicMarkers', 'activeChatIdRef', 'setError', 't', 'anchorAttachment', 'listRef', code);
  function render() {
    run(fn => { cleanup = fn(); }, false, loading.pending, { chat_id: 'chat' }, next,
      () => 'found', {},
      () => { scrolls++; return true; }, () => assert.fail('already loaded'), () => {}, next => next,
      loading.activeId, () => {}, { attachmentUnavailable: 'Unavailable', messagesLoadFailed: 'Load failed' },
      (_, id, done) => { assert.equal(id, 'file'); complete = done; return () => { complete = null; }; },
      { current: {} });
  }
  render(); cleanup(); // A new message/render cancels the old effect before its timer fires.
  assert.equal(loading.pending.current, 'file');
  assert.equal(complete, null);
  render(); complete('visible');
  assert.equal(scrolls, 0); // The anchoring controller owns scrolling, not this effect.
  assert.equal(loading.pending.current, null);
  cleanup();
});
test('missing historical attachment reports unavailable instead of silently scrolling', async () => {
  const view = mount(async () => []);
  await flush();
  assert.equal(view.error(), 'Unavailable');
  view.cleanup();
});
test('a late history failure cannot overwrite a newer conversation', async () => {
  let reject;
  const view = mount(() => new Promise((_, r) => { reject = r; }));
  view.activeId.current = 'other';
  view.cleanup();
  reject(new Error('offline'));
  await flush();
  assert.equal(view.error(), undefined);
  assert.equal(view.updates(), 0);
});
test('leaving a history jump aborts its real pagination signal', async () => {
  let signal;
  const view = mount((_, __, ___, currentSignal) => {
    signal = currentSignal;
    return new Promise((_, reject) => signal.addEventListener('abort', () =>
      reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
  });
  assert.equal(signal.aborted, false);
  view.cleanup(); await flush();
  assert.equal(signal.aborted, true);
  assert.equal(view.error(), undefined);
});
