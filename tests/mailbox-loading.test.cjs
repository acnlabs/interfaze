const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,
  '../packages/agent-chat/src/MailboxThumbs.tsx'), 'utf8');
const start = source.indexOf('  useEffect(() => {');
const end = source.indexOf('  const visible =', start);
assert.ok(start >= 0 && end > start);
const effectCode = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function mount(getAccessToken, fetch, URL) {
  let effect;
  const state = { files: [], failed: [], statuses: {} };
  new Function('useEffect', 'ids', 'chatId', 'gatewayBaseUrl', 'getAccessToken',
    'retryCount', 'setFiles', 'setFailedIds', 'fetch', 'URL', 'joinUrl',
    'filenameFromDisposition', 'listedFromHeader', 'setFailedStatus', effectCode)(
    f => { effect = f; }, ['file'], 'chat', 'https://gateway.example', getAccessToken,
    0, value => { state.files = value; }, value => { state.failed = value; },
    fetch, URL, (base, route) => base + route, (_, fallback) => fallback, () => 0,
    value => { state.statuses = value; });
  return { state, cleanup: effect() };
}
test('unmount during blob loading aborts and cannot leak an object URL', async () => {
  let finishBlob, signal;
  let created = 0;
  const result = mount(async () => 'test-token', async (_, options) => {
    signal = options.signal;
    return { ok: true, blob: () => new Promise(resolve => { finishBlob = resolve; }) };
  }, { createObjectURL() { created++; return 'blob:test'; }, revokeObjectURL() {} });
  await flush();
  result.cleanup();
  assert.equal(signal.aborted, true);
  finishBlob({ type: 'image/png' });
  await flush();
  assert.equal(created, 0);
  assert.deepEqual(result.state.files, []);
});
test('token failure is shown as retryable rather than an unhandled rejection', async () => {
  const result = mount(async () => { throw new Error('expired'); },
    () => { assert.fail('must not fetch without a token'); }, {});
  await flush();
  assert.deepEqual(result.state.failed, ['file']);
  result.cleanup();
});
test('object-storage links use the signed url and do not create a blob', async () => {
  let created = 0;
  const result = mount(async () => 'test-token', async () => ({
    ok: true,
    headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
    json: async () => ({
      url: 'https://r2.example/obj',
      content_type: 'image/png',
      filename: 'duck.png',
      listed_credits: 3,
    }),
  }), { createObjectURL() { created++; return 'blob:test'; }, revokeObjectURL() {} });
  await flush();
  assert.equal(created, 0);
  assert.equal(result.state.files.length, 1);
  assert.equal(result.state.files[0].url, 'https://r2.example/obj');
  assert.equal(result.state.files[0].contentType, 'image/png');
  result.cleanup();
});
test('successful attachments release their object URL on cleanup', async () => {
  const revoked = [];
  const result = mount(async () => 'test-token', async () => ({
    ok: true, blob: async () => ({ type: 'image/png' }), headers: { get: () => null },
  }), { createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) });
  await flush();
  assert.equal(result.state.files.length, 1);
  result.cleanup();
  assert.deepEqual(revoked, ['blob:test']);
});
test('missing files and denied access retain distinct HTTP status evidence', async () => {
  for (const status of [401, 403, 404, 410, 503]) {
    const result = mount(async () => 'test-token', async () => ({ ok: false, status }), {});
    await flush();
    assert.deepEqual(result.state.failed, ['file']);
    assert.equal(result.state.statuses.file, status);
    result.cleanup();
  }
});
