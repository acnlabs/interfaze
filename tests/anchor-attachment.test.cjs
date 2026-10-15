const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,
  '../packages/agent-chat/src/anchorAttachment.ts'), 'utf8'), { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
} }).outputText;
function mount() {
  const frames = new Map(), listeners = new Map(), observers = [];
  let id = 0, deadline, offset = 2000, present = true, complete = false;
  const results = [], scrolls = [];
  const list = { scrollTop: 0, clientHeight: 500, children: [{}],
    getBoundingClientRect: () => ({ top: 100 }),
    querySelector(selector) { assert.equal(selector, '[data-mailbox-id="file"]'); return present ? target : null; },
    querySelectorAll: () => [image],
    scrollTo({ top, behavior }) { assert.equal(behavior, 'auto'); this.scrollTop = top; scrolls.push(top); },
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: event => listeners.delete(event),
  };
  const target = { getBoundingClientRect: () => ({ top: 100 + offset - list.scrollTop,
    bottom: 320 + offset - list.scrollTop, height: 220 }) };
  const image = { tagName: 'IMG', get complete() { return complete; }, hasAttribute: () => false,
    getBoundingClientRect: () => ({ top: 600 - list.scrollTop }) };
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const exports = {};
  new Function('exports', 'ResizeObserver', 'MutationObserver', 'requestAnimationFrame',
    'cancelAnimationFrame', 'setTimeout', 'clearTimeout', code)(exports, Observer, Observer,
    fn => { frames.set(++id, fn); return id; }, n => frames.delete(n),
    fn => { deadline = fn; return 1; }, () => {});
  const stop = exports.anchorAttachment(list, 'file', result => results.push(result));
  const tick = () => { const current = [...frames.values()]; frames.clear(); current.forEach(fn => fn()); };
  return { list, target, results, scrolls, observers, listeners, stop, tick,
    load: () => { complete = true; offset += 800; listeners.get('load')?.({}); },
    insert: () => { present = true; observers[1].callback(); },
    hide: () => { present = false; }, timeout: () => deadline(),
  };
}
test('targets the selected attachment and corrects a preceding image layout shift', () => {
  const view = mount(); view.tick();
  assert.deepEqual(view.results, []);
  view.load(); view.tick(); view.tick();
  assert.deepEqual(view.results, ['visible']);
  const rect = view.target.getBoundingClientRect();
  assert.ok(rect.top >= 100 && rect.bottom <= 600);
  assert.equal(view.list.scrollTop, 2660);
  assert.ok(view.observers.every(o => o.disconnected));
  assert.equal(view.listeners.size, 0);
});
test('wheel input stops anchoring without fighting subsequent layout changes', () => {
  const view = mount(); view.tick();
  const count = view.scrolls.length;
  view.listeners.get('wheel')({ type: 'wheel' });
  view.observers[0].callback(); view.tick();
  assert.deepEqual(view.results, ['cancelled']);
  assert.equal(view.scrolls.length, count);
});
test('unmount and deadline disconnect observers and never keep scrolling', () => {
  const view = mount(); view.stop(); view.tick();
  assert.equal(view.scrolls.length, 0);
  assert.deepEqual(view.results, []);
  const timed = mount(); timed.timeout(); timed.tick();
  assert.deepEqual(timed.results, ['timeout']);
  assert.equal(timed.scrolls.length, 0);
  assert.ok(timed.observers.every(o => o.disconnected));
});
test('a target rendered later is found on DOM mutation rather than a longer delay', () => {
  const view = mount(); view.hide(); view.tick();
  assert.equal(view.scrolls.length, 0);
  view.insert(); view.tick();
  assert.equal(view.scrolls.length, 1);
  view.stop();
});
