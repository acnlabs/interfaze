const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/attachmentDownload.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const output = {};
new Function('exports', code)(output);
const { attachmentDownload, allowedAttachmentStorage } = output;
const request = (query = 'chat=chat-a&attachment=file-a', auth = 'Bearer fixture-token') => new Request(
  `http://localhost:3010/api/attachments/download?${query}`, { headers: auth ? { Authorization: auth } : {} });
const metadata = (url = 'https://bucket.fixture/tiny.mp4?signature=private', filename = 'tiny.mp4') => Response.json({ url, filename });
const options = fetcher => ({ gatewayBaseUrl: 'https://api.fixture', storageHosts: ['bucket.fixture'], fetcher });

test('same-origin relay authorizes the exact chat/file then streams bytes without forwarding the token', async () => {
  let calls = 0;
  const response = await attachmentDownload(request(), options(async (url, init) => {
    calls++;
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    if (calls === 1) {
      assert.equal(String(url), 'https://api.fixture/api/chats/chat-a/files/file-a');
      assert.equal(init.headers.Authorization, 'Bearer fixture-token');
      return metadata();
    }
    assert.equal(new URL(url).hostname, 'bucket.fixture');
    assert.equal(init.headers, undefined);
    assert.equal(init.credentials, 'omit');
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'video/mp4' } });
  }));
  assert.equal(response.status, 200);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  assert.match(response.headers.get('content-disposition'), /^attachment; filename="tiny.mp4"/);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.ok(!JSON.stringify([...response.headers]).includes('signature'));
  assert.equal(calls, 2);
});
test('missing credentials, arbitrary URL inputs and malformed IDs never reach an upstream', async () => {
  for (const [req, status] of [[request(undefined, ''), 401], [request('chat=a&attachment=b&url=https://evil.fixture'), 400],
    [request('chat=a%2F..&attachment=b'), 400], [request('chat=a&chat=b&attachment=c'), 400]]) {
    const response = await attachmentDownload(req, options(() => assert.fail('not authorized')));
    assert.equal(response.status, status);
  }
});
test('API permission denial is preserved and never fetches storage', async () => {
  let calls = 0;
  const response = await attachmentDownload(request(), options(async () => { calls++; return new Response(null, { status: 403 }); }));
  assert.equal(response.status, 403);
  assert.equal(calls, 1);
});
test('unapproved hosts, insecure URLs, embedded credentials and redirects are refused', async () => {
  for (const url of ['http://bucket.fixture/a', 'https://127.0.0.1/a', 'https://localhost/a',
    'https://user:pass@bucket.fixture/a', 'https://bucket.fixture:444/a', 'https://bucket.fixture.evil/a']) {
    let calls = 0;
    const response = await attachmentDownload(request(), options(async () => { calls++; return metadata(url); }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, 'attachment_storage_host_not_allowed');
    assert.equal(calls, 1);
  }
  let calls = 0;
  const response = await attachmentDownload(request(), options(async (_, init) => {
    calls++; assert.equal(init.redirect, 'error');
    return calls === 1 ? metadata() : new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1' } });
  }));
  assert.equal(response.status, 502); assert.equal(calls, 2);
  assert.equal(response.headers.get('location'), null);
});
test('oversized metadata or declared files are rejected with fixed, non-sensitive errors', async () => {
  const tooMuchMetadata = await attachmentDownload(request(), options(async () => new Response('x'.repeat(33000), {
    headers: { 'Content-Type': 'application/json' },
  })));
  assert.equal((await tooMuchMetadata.json()).error, 'attachment_metadata_invalid');
  let count = 0;
  const oversized = await attachmentDownload(request(), options(async () => ++count === 1 ? metadata()
    : new Response('small', { headers: { 'Content-Length': String(101 * 1024 * 1024) } })));
  assert.equal(oversized.status, 413);
});
test('a streaming size limit is enforced even without content-length', async () => {
  let count = 0;
  const response = await attachmentDownload(request(), options(async () => ++count === 1 ? metadata() : {
    ok: true, headers: new Headers(), body: new ReadableStream({ start(stream) {
      stream.enqueue({ byteLength: 101 * 1024 * 1024 }); stream.close();
    } }),
  }));
  await assert.rejects(response.arrayBuffer(), /Attachment transfer failed/);
});
test('storage failure is returned without leaking the signed URL or exception', async () => {
  let count = 0;
  const response = await attachmentDownload(request(), options(async () => {
    if (++count === 1) return metadata();
    throw new Error('private-signed-url-and-token');
  }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'attachment_storage_unreachable' });
});
test('caller cancellation closes a stalled upstream body and rejects the transfer', async () => {
  const caller = new AbortController();
  const req = new Request('http://localhost/api/attachments/download?chat=a&attachment=b', {
    headers: { Authorization: 'Bearer fixture-token' }, signal: caller.signal,
  });
  let count = 0, cancelled = false;
  const response = await attachmentDownload(req, options(async () => ++count === 1 ? metadata()
    : new Response(new ReadableStream({ cancel() { cancelled = true; } }))));
  const transfer = response.arrayBuffer();
  caller.abort();
  await assert.rejects(transfer, /Attachment transfer failed/);
  assert.equal(cancelled, true);
});
test('malformed Unicode filenames do not turn valid bytes into a failed response', async () => {
  let count = 0;
  const response = await attachmentDownload(request(), options(async () => ++count === 1
    ? metadata(undefined, '\ud800.mp4') : new Response('bytes')));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /filename="_.mp4"/);
  assert.equal(await response.text(), 'bytes');
});
test('filenames cannot inject response headers and supported provider suffixes are exact', async () => {
  let count = 0;
  const response = await attachmentDownload(request(), options(async () => ++count === 1
    ? metadata(undefined, '图"\r\nunsafe.mp4') : new Response('bytes')));
  const header = response.headers.get('content-disposition');
  assert.doesNotMatch(header, /[\r\n]/);
  assert.match(header, /filename\*=UTF-8''/);
  await response.arrayBuffer();
  assert.equal(allowedAttachmentStorage(new URL('https://account.r2.cloudflarestorage.com/object'), []), true);
  assert.equal(allowedAttachmentStorage(new URL('https://account.r2.cloudflarestorage.com.evil/object'), []), false);
});
test('Railway documented endpoint supports path and virtual styles, never lookalike domains', async () => {
  for (const host of ['t3.storageapi.dev', 'chat-files-fixture.t3.storageapi.dev']) {
    assert.equal(allowedAttachmentStorage(new URL(`https://${host}/object`), []), true);
    let calls = 0;
    const response = await attachmentDownload(request(), { gatewayBaseUrl: 'https://api.fixture', fetcher: async () =>
      ++calls === 1 ? metadata(`https://${host}/object`) : new Response('fixture-bytes') });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'fixture-bytes');
    assert.equal(calls, 2);
  }
  for (const host of ['evil.storageapi.dev', 't3.storageapi.dev.evil', 'evil.railway.app', 'a.b.t3.storageapi.dev']) {
    assert.equal(allowedAttachmentStorage(new URL(`https://${host}/object`), []), false);
  }
});
