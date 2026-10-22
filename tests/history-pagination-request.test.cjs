const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../packages/agent-chat/src/gateway.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS } }).outputText;
function client(fetch, token = async () => 'test-token', diagnostics = [], development = false) {
  const exports = {};
  new Function('exports', 'require', 'fetch', 'process', 'console', code)(exports,
    (specifier) => {
      if (String(specifier).includes('inflight')) {
        const inflight = {};
        const inflightSource = fs.readFileSync(
          path.join(__dirname, '../packages/agent-chat/src/inflight.ts'), 'utf8');
        const inflightCode = ts.transpileModule(inflightSource, { compilerOptions: {
          target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
        new Function('exports', inflightCode)(inflight);
        return inflight;
      }
      return { normalizeChatMessage: row => row };
    }, fetch,
    { env: { NODE_ENV: development ? 'development' : 'production' } }, { warn: line => diagnostics.push(line) });
  return exports.createGatewayClient('https://gateway.fixture', token);
}
test('history GET preserves the exact encoded cursor, page limit and cancellation signal', async () => {
  const controller = new AbortController();
  const api = client(async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/chats/chat-a/messages');
    assert.equal(parsed.searchParams.get('before'), 'message|old?cursor');
    assert.equal(parsed.searchParams.get('limit'), '50');
    assert.equal(init.signal, controller.signal);
    return { ok: true, json: async () => [{ message_id: 'old' }] };
  });
  assert.deepEqual(await api.listMessages('chat-a', { before: 'message|old?cursor', limit: 50,
    signal: controller.signal }), [{ message_id: 'old' }]);
});
test('history diagnostics identify the failing stage without private request or response data', async () => {
  const privateValue = 'private-fixture-token-cursor-body';
  const cases = [
    { token: async () => null, fetch: () => assert.fail('no token'), phase: 'token', status: null, reason: 'token_unavailable' },
    { fetch: async () => { throw new TypeError(privateValue); }, phase: 'request', status: null, reason: 'transport_or_policy' },
    { fetch: async () => ({ ok: false, status: 503, json: async () => ({ detail: privateValue }) }), phase: 'response', status: 503, reason: 'http_error' },
    { fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(privateValue); } }), phase: 'response_parse', status: 200, reason: 'invalid_response' },
    { fetch: async () => ({ ok: true, status: 200, json: async () => { throw new TypeError(privateValue); } }), phase: 'response_parse', status: 200, reason: 'body_read_failed' },
  ];
  for (const item of cases) {
    const logs = [];
    const api = client(item.fetch, item.token || (async () => privateValue), logs, true);
    await assert.rejects(api.listMessages('private-chat', { before: privateValue, limit: 50, diagnosticPage: 2 }));
    assert.equal(logs.length, 1);
    const detail = JSON.parse(logs[0].slice('[history-request] '.length));
    assert.equal(detail.kind, 'messages');
    assert.equal(detail.phase, item.phase);
    assert.equal(detail.httpStatus, item.status);
    assert.equal(detail.reason, item.reason);
    assert.equal(detail.page, 2);
    assert.equal(detail.hasCursor, true);
    assert.equal(detail.limit, 50);
    assert.ok(!logs[0].includes(privateValue));
    assert.ok(!logs[0].includes('private-chat'));
  }
});
test('malformed 200 list responses do not masquerade as no attachments', async () => {
  const logs = [];
  const api = client(async () => ({ ok: true, status: 200, json: async () => ({}) }), undefined, logs, true);
  await assert.rejects(api.listChatFiles('chat-a'), { name: 'SyntaxError' });
  assert.equal(JSON.parse(logs[0].slice('[history-request] '.length)).kind, 'files');
  await assert.rejects(api.listMessages('chat-a'), { name: 'SyntaxError' });
  assert.equal(JSON.parse(logs[1].slice('[history-request] '.length)).kind, 'messages');
});
test('successful lists and production failures do not emit history diagnostics', async () => {
  const logs = [];
  const success = client(async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) }), undefined, logs, true);
  assert.deepEqual(await success.listChatFiles('chat-a'), []);
  const failed = client(async () => { throw new TypeError('private'); }, undefined, logs, false);
  await assert.rejects(failed.listMessages('chat-a'));
  assert.deepEqual(logs, []);
});
test('list diagnostics do not change the single-message response contract for POST sends', async () => {
  const logs = [];
  const api = client(async (_, init) => {
    assert.equal(init.method, 'POST');
    return { ok: true, status: 200, json: async () => ({ message_id: 'new-message' }) };
  }, undefined, logs, true);
  assert.deepEqual(await api.sendMessage('chat-a', 'test'), { message_id: 'new-message' });
  assert.deepEqual(logs, []);
});
test('an empty 204 list response is a parse failure, not a successful empty history', async () => {
  const logs = [];
  const api = client(async () => ({ ok: true, status: 204 }), undefined, logs, true);
  await assert.rejects(api.listChatFiles('chat-a'), { name: 'SyntaxError' });
  const detail = JSON.parse(logs[0].slice('[history-request] '.length));
  assert.equal(detail.phase, 'response_parse');
  assert.equal(detail.httpStatus, 204);
});
test('a cancelled token lookup cannot start a late history request', async () => {
  let finish;
  const api = client(() => assert.fail('cancelled request must not reach the network'),
    () => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const pending = api.listMessages('chat-a', { signal: controller.signal });
  controller.abort(); finish('token');
  await assert.rejects(pending, { name: 'AbortError' });
});
test('HTTP errors remain distinguishable from transport errors and token failures', async () => {
  const denied = client(async () => ({ ok: false, status: 403, statusText: 'Forbidden', json: async () => ({}) }));
  await assert.rejects(denied.listMessages('chat-a'), error => error.status === 403);
  const offline = client(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(offline.listMessages('chat-a'), { name: 'TypeError' });
  const unsigned = client(() => assert.fail('no token'), async () => null);
  await assert.rejects(unsigned.listMessages('chat-a'), error => error.status === 401 && error.code === 'not_authenticated');
});
test('the actual historical search stops paging after its in-flight page is cancelled', async () => {
  const shell = fs.readFileSync(path.join(__dirname, '../packages/agent-chat/src/ranch-shell/RanchChatShell.tsx'), 'utf8');
  const start = shell.indexOf('  const loadOlderUntilMailbox = useCallback(');
  const end = shell.indexOf('  useEffect(() => {', start);
  assert.ok(start >= 0 && end > start);
  const actual = ts.transpileModule(shell.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const controller = new AbortController();
  let finish, calls = 0;
  const load = new Function('useCallback', 'client', 'messageIdForMailbox', 'LOCAL_TOPIC_START_PREFIX', actual + '\nreturn loadOlderUntilMailbox;')(
    fn => fn, { listMessages: async (_, opts) => {
      calls++;
      assert.equal(opts.before, 'first');
      assert.equal(opts.limit, 50);
      assert.equal(opts.signal, controller.signal);
      return new Promise(resolve => { finish = resolve; });
    } }, () => null, 'local-topic:');
  const current = [{ message_id: 'first' }];
  const pending = load('chat-a', 'file', current, controller.signal);
  controller.abort(); finish([{ message_id: 'older' }]);
  assert.deepEqual(await pending, current);
  assert.equal(calls, 1);
});
