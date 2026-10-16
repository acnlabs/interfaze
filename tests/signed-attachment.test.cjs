const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname,
  '../packages/agent-chat/src/SignedAttachmentLink.tsx'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function mount(fetch, getAccessToken = async () => 'fixture-token', busy = false, clocks = {}, props = {}, development = false) {
  let cleanup, errors = 0;
  const links = [];
  const busyStates = [];
  const diagnostics = [];
  const releases = [], revoked = [], appended = [];
  let stateIndex = 0;
  const exports = {};
  const react = { useRef: value => ({ current: value }), useState: () => {
    const index = stateIndex++;
    return [index === 0 ? busy : false, value => { if (index === 0) busyStates.push(value); }];
  },
    useEffect: fn => { cleanup = fn(); } };
  class DownloadURL extends URL {
    static createObjectURL() { return 'blob:fixture'; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  new Function('exports', 'require', 'fetch', 'document', 'setTimeout', 'clearTimeout', 'URL', 'process', 'console', code)(exports,
    name => name === 'react' ? react : { jsx: (_, props) => props, jsxs: (_, props) => props }, fetch,
    { body: { appendChild(link) { appended.push(link); } },
      createElement: () => ({ click() { if (clocks.saveError) throw clocks.saveError; links.push(this.href); }, remove() {} }) },
    (fn, delay) => delay === 60_000 && fn.name !== 'expire'
      ? (releases.push(fn), 0) : (clocks.setTimeout || setTimeout)(fn, delay),
    clocks.clearTimeout || clearTimeout, DownloadURL,
    { env: { NODE_ENV: development ? 'development' : 'production' } },
    { warn: (...args) => diagnostics.push(args) });
  const button = exports.SignedAttachmentLink({ endpoint: 'https://api.fixture/file',
    name: 'file.txt', getAccessToken, onError: () => errors++, ...props });
  return { button, links, busyStates, releases, revoked, appended, diagnostics, cleanup: () => cleanup(), errors: () => errors };
}
test('each download reauthorizes and uses a newly signed URL', async () => {
  let requests = 0, tokens = 0;
  const view = mount(async (_, options) => {
    assert.equal(options.headers.Authorization, `Bearer token-${tokens}`);
    return { ok: true, json: async () => ({ url: `https://bucket.fixture/${++requests}` }) };
  }, async () => `token-${++tokens}`);
  view.button.onClick(); await flush();
  view.button.onClick(); await flush();
  assert.deepEqual(view.links, ['https://bucket.fixture/1', 'https://bucket.fixture/2']);
  view.cleanup();
});
test('development diagnostics identify each download stage without URLs, tokens or exception messages', async () => {
  const secret = 'fixture-private-value-never-log';
  const signature = { ok: true, status: 200, json: async () => ({ url: `https://bucket.fixture/media?signature=${secret}` }) };
  const cases = [
    { token: async () => null, fetch: () => assert.fail('no token'), phase: 'token', reason: 'missing_token', status: null },
    { fetch: async () => ({ ok: false, status: 401 }), phase: 'authorization-request', reason: 'http_error', status: 401 },
    { fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(secret); } }), phase: 'authorization-body', reason: 'invalid_json', status: 200 },
    { fetch: async () => ({ ok: true, status: 200, json: async () => ({ url: secret }) }), phase: 'signed-url', reason: 'invalid_signed_url', status: 200 },
    { file: async () => { throw new TypeError(secret); }, phase: 'file-request', reason: 'transport_or_policy', status: null },
    { file: async () => ({ ok: false, status: 403 }), phase: 'file-request', reason: 'http_error', status: 403 },
    { file: async () => ({ ok: true, status: 200, blob: async () => { throw new TypeError(secret); } }), phase: 'file-body', reason: 'transport_or_policy', status: 200 },
    { file: async () => ({ ok: true, status: 200, blob: async () => ({ size: 0 }) }), phase: 'file-body', reason: 'empty_file', status: 200 },
  ];
  for (const item of cases) {
    const view = mount(item.fetch || (async url => url === 'https://api.fixture/file' ? signature : item.file()),
      item.token || (async () => secret), false, {}, { saveAsBlob: true }, true);
    view.button.onClick(); await flush();
    assert.equal(view.diagnostics.length, 1);
    const [entry] = view.diagnostics[0];
    assert.ok(entry.startsWith('[attachment-download] '));
    const detail = JSON.parse(entry.slice('[attachment-download] '.length));
    assert.equal(detail.phase, item.phase);
    assert.equal(detail.reason, item.reason);
    assert.equal(detail.status, item.status);
    assert.deepEqual(Object.keys(detail).sort(), ['errorType', 'phase', 'reason', 'status']);
    assert.ok(!JSON.stringify(view.diagnostics).includes(secret));
    assert.deepEqual(view.links, []);
    view.cleanup();
  }
});
test('a browser save-trigger error is distinguished from a file fetch failure', async () => {
  const view = mount(async url => url === 'https://api.fixture/file'
    ? { ok: true, status: 200, json: async () => ({ url: 'https://bucket.fixture/media' }) }
    : { ok: true, status: 200, blob: async () => ({ size: 10 }) }, undefined, false,
    { saveError: new Error('private browser error') }, { saveAsBlob: true }, true);
  view.button.onClick(); await flush();
  const detail = JSON.parse(view.diagnostics[0][0].slice('[attachment-download] '.length));
  assert.equal(detail.phase, 'save-trigger');
  assert.equal(detail.status, 200);
  assert.deepEqual(view.links, []);
  assert.equal(view.releases.length, 1);
  view.releases[0](); view.cleanup();
});
test('production does not emit download diagnostics', async () => {
  const view = mount(async () => { throw new TypeError('private url'); });
  view.button.onClick(); await flush();
  assert.deepEqual(view.diagnostics, []);
  view.cleanup();
});
test('configured host download uses only the authenticated same-origin route and saves its bytes', async () => {
  let calls = 0;
  const view = mount(async (url, init) => {
    calls++;
    assert.equal(url, '/api/attachments/download?chat=a&attachment=b');
    assert.equal(init.headers.Authorization, 'Bearer fixture-token');
    return { ok: true, status: 200, blob: async () => ({ size: 100 }) };
  }, undefined, false, {}, { downloadEndpoint: '/api/attachments/download?chat=a&attachment=b' });
  view.button.onClick(); await flush();
  assert.equal(calls, 1);
  assert.deepEqual(view.links, ['blob:fixture']);
  view.releases[0](); view.cleanup();
});
test('proxy failures expose only an allowlisted diagnostic reason and never save an error body', async () => {
  const view = mount(async () => ({ ok: false, status: 502,
    json: async () => ({ error: 'attachment_storage_host_not_allowed' }) }), undefined, false, {},
    { downloadEndpoint: '/api/attachments/download?chat=a&attachment=b' }, true);
  view.button.onClick(); await flush();
  const detail = JSON.parse(view.diagnostics[0][0].slice('[attachment-download] '.length));
  assert.equal(detail.phase, 'same-origin-file-request');
  assert.equal(detail.reason, 'attachment_storage_host_not_allowed');
  assert.deepEqual(view.links, []);
  view.cleanup();
});
test('same-origin download rejects browser URL normalization escapes before sending a token', async () => {
  for (const downloadEndpoint of ['//evil.fixture/file', '/\\evil.fixture/file', '/\n/evil.fixture/file', 'https://evil.fixture/file']) {
    const view = mount(() => assert.fail('must not transmit the bearer'), undefined, false, {}, { downloadEndpoint });
    view.button.onClick(); await flush();
    assert.equal(view.errors(), 1);
    assert.deepEqual(view.links, []);
    view.cleanup();
  }
});
test('file transfer has a bounded longer deadline than token and authorization', async () => {
  const delays = [];
  const view = mount(async () => ({ ok: true, blob: async () => ({ size: 10 }) }), undefined, false,
    { setTimeout(_, delay) { delays.push(delay); return delays.length; }, clearTimeout() {} },
    { downloadEndpoint: '/api/attachments/download?chat=a&attachment=b' });
  view.button.onClick(); await flush();
  assert.deepEqual(delays, [10_000, 60_000]);
  assert.deepEqual(view.links, ['blob:fixture']);
  view.releases[0](); view.cleanup();
});
test('media download obtains fresh bytes without forwarding credentials and triggers a named blob save', async () => {
  const view = mount(async (url, options) => {
    if (url === 'https://api.fixture/file') return { ok: true, json: async () => ({ url: 'https://bucket.fixture/media' }) };
    assert.equal(url, 'https://bucket.fixture/media');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    return { ok: true, blob: async () => ({ size: 1685 }) };
  }, undefined, false, {}, { saveAsBlob: true, name: 'tiny.mp4' });
  view.button.onClick(); await flush();
  assert.deepEqual(view.links, ['blob:fixture']);
  assert.equal(view.appended[0].download, 'tiny.mp4');
  assert.equal(view.errors(), 0);
  assert.deepEqual(view.revoked, []);
  view.releases[0]();
  assert.deepEqual(view.revoked, ['blob:fixture']);
  view.cleanup();
});
test('media HTTP, empty byte and CORS failures never trigger a save and allow retry', async () => {
  for (const fileResponse of [() => ({ ok: false }), () => ({ ok: true, blob: async () => ({ size: 0 }) }),
    () => { throw new TypeError('Failed to fetch'); }]) {
    const view = mount(async url => url === 'https://api.fixture/file'
      ? { ok: true, json: async () => ({ url: 'https://bucket.fixture/media' }) }
      : fileResponse(), undefined, false, {}, { saveAsBlob: true });
    view.button.onClick(); await flush();
    assert.equal(view.errors(), 1);
    assert.deepEqual(view.links, []);
    assert.deepEqual(view.busyStates, [true, false]);
    view.button.onClick(); await flush();
    assert.equal(view.errors(), 2);
    view.cleanup();
  }
});
test('busy download shows progress without claiming the file has been saved', () => {
  const view = mount(() => assert.fail('render must not download'), undefined, true);
  assert.equal(view.button.disabled, true);
  assert.equal(view.button['aria-busy'], true);
  assert.equal(view.button.children[1].role, 'status');
  assert.equal(view.button.children[1].children, 'Preparing download…');
  view.cleanup();
});
test('repeated clicks while authorization is pending make only one request', async () => {
  let finish, tokens = 0, requests = 0;
  const view = mount(async () => {
    requests++;
    return { ok: true, json: async () => ({ url: 'https://bucket.fixture/file' }) };
  }, () => { tokens++; return new Promise(resolve => { finish = resolve; }); });
  view.button.onClick(); view.button.onClick();
  assert.equal(tokens, 1);
  finish('fixture-token'); await flush();
  assert.equal(requests, 1);
  assert.equal(view.links.length, 1);
  view.cleanup();
});
test('failed authorization or unsafe links expose retry and never navigate', async () => {
  for (const result of [{ ok: false }, { ok: true, json: async () => ({ url: 'javascript:alert(1)' }) }]) {
    const view = mount(async () => result);
    view.button.onClick(); await flush();
    assert.equal(view.errors(), 1); assert.deepEqual(view.links, []);
    view.cleanup();
  }
});
test('unmount while fetching a token prevents request and navigation', async () => {
  let finish;
  const view = mount(() => assert.fail('must not request after unmount'),
    () => new Promise(resolve => { finish = resolve; }));
  view.button.onClick(); view.cleanup(); finish('fixture-token'); await flush();
  assert.deepEqual(view.links, []); assert.equal(view.errors(), 0);
});
test('authorization timeout releases busy state and permits retry without a late download', async () => {
  let timeout, resolveOld, attempts = 0, requests = 0;
  const view = mount(async () => {
    requests++;
    return { ok: true, json: async () => ({ url: 'https://bucket.fixture/retry' }) };
  }, () => ++attempts === 1 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve('token'),
  false, { setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() {} });
  view.button.onClick(); timeout(); await flush();
  assert.equal(view.errors(), 1);
  assert.deepEqual(view.busyStates, [true, false]);
  view.button.onClick(); await flush();
  assert.equal(requests, 1);
  resolveOld('late-token'); await flush();
  assert.deepEqual(view.links, ['https://bucket.fixture/retry']);
  view.cleanup();
});
test('empty, malformed and invalid signed responses fail without navigating', async () => {
  for (const json of [async () => null, async () => ({}), async () => ({ url: '' }),
    async () => { throw new SyntaxError('empty response'); }, async () => ({ url: 'http://bucket.fixture/file' })]) {
    const view = mount(async () => ({ ok: true, json }));
    view.button.onClick(); await flush();
    assert.equal(view.errors(), 1);
    assert.deepEqual(view.links, []);
    assert.deepEqual(view.busyStates, [true, false]);
    view.cleanup();
  }
});
