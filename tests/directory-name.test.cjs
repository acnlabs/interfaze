const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,
  '../src/lib/directoryName.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function load(fetch) {
  const exports = {};
  const delays = [];
  new Function('exports', 'require', 'fetch', 'setTimeout', 'clearTimeout', code)(
    exports, () => ({ getGatewayBaseUrl: () => 'https://fixture.invalid' }), fetch,
    (fn, ms) => {
      if (ms < 10_000) delays.push(ms);
      return setTimeout(fn, ms < 10_000 ? 0 : ms);
    }, clearTimeout);
  return { ...exports, delays };
}
const response = (status, body) => ({ ok: status < 400, status, json: async () => body });
test('HTTP and business failures reject; only explicit success resolves', async () => {
  for (const result of [response(503, {}), response(200, { ok: false }), response(200, {})]) {
    const api = load(async () => result);
    await assert.rejects(api.rememberDirectoryName('fixture-token'));
  }
  await load(async () => response(200, { ok: true })).rememberDirectoryName('fixture-token');
});
test('transient failure retries with backoff and a newly requested token', async () => {
  let calls = 0, tokens = 0;
  const api = load(async () => ++calls < 3 ? response(503, {}) : response(200, { ok: true }));
  await api.rememberDirectoryNameWithRetry(async () => { tokens++; return 'fixture-token'; },
    new AbortController().signal);
  assert.equal(calls, 3);
  assert.equal(tokens, 3);
  assert.deepEqual(api.delays, [1000, 2000]);
});
test('persistent failure stops after three attempts', async () => {
  let calls = 0;
  const api = load(async () => { calls++; return response(200, { ok: false }); });
  await assert.rejects(api.rememberDirectoryNameWithRetry(async () => 'fixture-token',
    new AbortController().signal));
  assert.equal(calls, 3);
});
test('denied permissions are not retried', async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    const api = load(async () => { calls++; return response(status, {}); });
    await assert.rejects(api.rememberDirectoryNameWithRetry(async () => 'fixture-token',
      new AbortController().signal));
    assert.equal(calls, 1);
  }
});
test('identity change while retrieving a token prevents the old request', async () => {
  let finishToken;
  const api = load(() => assert.fail('cancelled identity must not send'));
  const controller = new AbortController();
  const pending = api.rememberDirectoryNameWithRetry(
    () => new Promise(resolve => { finishToken = resolve; }), controller.signal);
  const rejected = assert.rejects(pending);
  controller.abort();
  finishToken('old-identity-token');
  await rejected;
});
test('unmount aborts an in-flight request and prevents retries', async () => {
  let requestSignal;
  const api = load((_, options) => new Promise((resolve, reject) => {
    requestSignal = options.signal;
    requestSignal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const controller = new AbortController();
  const pending = api.rememberDirectoryNameWithRetry(async () => 'fixture-token', controller.signal);
  const rejected = assert.rejects(pending);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await rejected;
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(api.delays, []);
});
