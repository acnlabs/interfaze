const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the actual handlers in isolation, without sending live chat messages.
const source = fs.readFileSync(path.join(__dirname,
  '../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx'), 'utf8');
const js = (body) => ts.transpileModule(body, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
function section(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1);
  return source.slice(from, to);
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('late message load completion cannot dismiss a newer conversation spinner', () => {
  const guard = source.match(/if \(seq === loadSeqRef\.current\) setLoadingMessages\(false\);/);
  assert.ok(guard);
  const handler = new Function('seq', 'loadSeqRef', 'setLoadingMessages',
    js(guard[0]));
  let loading = true;
  handler(1, { current: 2 }, value => { loading = value; });
  assert.equal(loading, true);
  handler(2, { current: 2 }, value => { loading = value; });
  assert.equal(loading, false);
});

test('retrying message loading preserves a composed draft', () => {
  const guard = section('      if (!opts?.preserveDraft) setDraft("");',
    '      setRecipientPickerOpen(false);');
  let draft = 'unfinished';
  const run = new Function('opts', 'setDraft', js(guard));
  run({ preserveDraft: true }, value => { draft = value; });
  assert.equal(draft, 'unfinished');
  run(undefined, value => { draft = value; });
  assert.equal(draft, '');
});

test('late presence response cannot switch the selected conversation', async () => {
  let effect, tick, resolve;
  let selected = { chat_id: 'A' };
  let updates = 0;
  const run = new Function('useEffect', 'open', 'active', 'client', 'window',
    'setChats', 'setActive', js(section('// Keep presence dots fresh', '  const flashTopicHighlight')));
  run(f => { effect = f; }, true, selected,
    { listChats: () => new Promise(r => { resolve = r; }) },
    { setInterval: f => { tick = f; return 1; }, clearInterval() {} },
    () => updates++, v => { selected = typeof v === 'function' ? v(selected) : v; });
  const cleanup = effect();
  tick();
  cleanup();
  selected = { chat_id: 'B' };
  resolve([{ chat_id: 'A' }, { chat_id: 'B' }]);
  await flush();
  assert.equal(selected.chat_id, 'B');
  assert.equal(updates, 0);
});

test('IME Enter does not send or select a slash option', () => {
  const handler = section('                  onKeyDown={(e) => {', '\n                  }}')
    .split('onKeyDown={(e) => {')[1];
  let sends = 0;
  const run = new Function('e', 'slashMenuOpen', 'agentRefOpen', 'mentionOpen',
    'tryRunSlashFromDraft', 'send', js(handler));
  for (const nativeEvent of [{ isComposing: true }, { keyCode: 229 }]) {
    run({ key: 'Enter', shiftKey: false, nativeEvent, preventDefault() {} },
      true, true, true, () => false, () => sends++);
  }
  assert.equal(sends, 0);
  run({ key: 'Enter', shiftKey: false, nativeEvent: {}, preventDefault() {} },
    false, false, false, () => false, () => sends++);
  assert.equal(sends, 1);
});

test('decision sends and stale sends preserve drafts', () => {
  const run = new Function('opts', 'seq', 'loadSeqRef', 'draft', 'setDraft',
    js(section('      if (!opts?.decisionChoice && seq === loadSeqRef.current)',
      '      await reloadMessages(chatId, seq);')));
  const check = (opts, seq, currentSeq, submitted, current, expected) => {
    let result = current;
    run(opts, seq, { current: currentSeq }, submitted,
      value => { result = typeof value === 'function' ? value(result) : value; });
    assert.equal(result, expected);
  };
  check({ decisionChoice: 'yes' }, 1, 1, 'draft', 'draft', 'draft');
  check(undefined, 1, 2, 'old', 'new chat draft', 'new chat draft');
  check(undefined, 1, 1, 'old', 'edited', 'edited');
  check(undefined, 1, 1, 'sent', 'sent', '');
});

test('topic filtering cannot promote an old decision', () => {
  const body = section('  const latestDecideId =', '  const studioOrigin');
  const run = new Function('groupActive', 'messages', 'displayMessages',
    'decideFromMetadata', js(body + '\nreturn latestDecideId;'));
  const old = { message_id: 'old', metadata: { decide: true } };
  const latest = { message_id: 'latest', metadata: { decide: true } };
  assert.equal(run(false, [old, latest], [old], m => m.decide), 'latest');
});

test('health recovers after failure and ignores results after cleanup', async () => {
  const body = section('  useEffect(() => {\n    if (!open) return;\n    let cancelled = false;\n    let checking = false;',
    '  /** Ensure host');
  let effect, tick, online, cleanup, pending;
  let healthy = null;
  let calls = 0;
  const client = { health: async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    if (calls === 2) return { ok: true };
    return new Promise(resolve => { pending = resolve; });
  } };
  new Function('useEffect', 'open', 'client', 'refreshChats', 'setHealthOk', 'window', js(body))(
    f => { effect = f; }, true, client, () => {}, value => { healthy = value; }, {
      setInterval(f) { tick = f; return 1; }, clearInterval() {},
      addEventListener(name, f) { online = f; },
      removeEventListener(name, f) { assert.equal(f, online); },
    });
  cleanup = effect();
  await flush();
  assert.equal(healthy, false);
  online();
  await flush();
  assert.equal(healthy, true);
  tick();
  cleanup();
  pending({ ok: false });
  await flush();
  assert.equal(healthy, true);
});
