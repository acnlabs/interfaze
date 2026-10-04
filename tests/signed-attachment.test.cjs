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
function mount(fetch, getAccessToken = async () => 'fixture-token') {
  let cleanup, errors = 0;
  const links = [];
  const exports = {};
  const react = { useRef: value => ({ current: value }), useState: () => [false, () => {}],
    useEffect: fn => { cleanup = fn(); } };
  new Function('exports', 'require', 'fetch', 'document', code)(exports,
    name => name === 'react' ? react : { jsx: (_, props) => props }, fetch,
    { createElement: () => ({ click() { links.push(this.href); } }) });
  const button = exports.SignedAttachmentLink({ endpoint: 'https://api.fixture/file',
    name: 'file.txt', getAccessToken, onError: () => errors++ });
  return { button, links, cleanup: () => cleanup(), errors: () => errors };
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
