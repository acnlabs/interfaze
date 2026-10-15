const MAX_BYTES = 100 * 1024 * 1024;
const MAX_METADATA = 32 * 1024;

type Options = { gatewayBaseUrl?: string; storageHosts?: string[]; fetcher?: typeof fetch };

export function allowedAttachmentStorage(url: URL, exactHosts: string[]): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  if (/^(localhost|.*\.localhost|.*\.local)$/.test(host) || /^[\d.]+$/.test(host) || host.includes(":")) return false;
  if (exactHosts.some(value => value.toLowerCase() === host)) return true;
  return /(?:^|\.)r2\.cloudflarestorage\.com$/.test(host)
    || /(?:^|\.)r2\.dev$/.test(host)
    // Railway's documented S3 endpoint, with optional virtual-hosted bucket.
    // Deliberately not a wildcard over all storageapi.dev or railway.app hosts.
    || /^(?:[a-z0-9-]+\.)?t3\.storageapi\.dev$/.test(host)
    || /^(?:[a-z0-9-]+\.)*s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?$/.test(host)
    || /^(?:[a-z0-9-]+\.)*(?:tos-s3-[a-z0-9-]+)\.(?:volces|bytepluses)\.com$/.test(host)
    || /^(?:[a-z0-9-]+\.)*oss-[a-z0-9-]+\.aliyuncs\.com$/.test(host)
    || /^(?:[a-z0-9-]+\.)*cos\.[a-z0-9-]+\.myqcloud\.com$/.test(host)
    || /^(?:[a-z0-9-]+\.)*s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(host);
}

function disposition(raw: unknown): string {
  const name = Array.from(typeof raw === "string" ? raw : "attachment").slice(0, 180)
    .map(char => /^[\uD800-\uDFFF]$/.test(char) ? "_" : char).join("")
    .replace(/[\x00-\x1f\x7f/\\"]/g, "_") || "attachment";
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, "%27")}`;
}

/** Authenticated, bounded file relay. No client-supplied upstream URL is accepted. */
export async function attachmentDownload(request: Request, options: Options = {}): Promise<Response> {
  const fail = (code: string, status: number) => Response.json({ error: code }, {
    status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
  const query = new URL(request.url).searchParams;
  const chat = query.get("chat") || "";
  const id = query.get("attachment") || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:|-]{0,199}$/.test(chat)
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(id)
      || query.getAll("chat").length !== 1 || query.getAll("attachment").length !== 1
      || Array.from(query.keys()).some(key => key !== "chat" && key !== "attachment")) return fail("invalid_attachment", 400);
  const auth = request.headers.get("authorization") || "";
  if (!/^Bearer [^\s]+$/i.test(auth) || auth.length > 8192) return fail("not_authenticated", 401);
  const configured = options.gatewayBaseUrl ?? process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
  let api: URL;
  try {
    api = new URL(configured.replace(/\/+$/, "") + `/api/chats/${encodeURIComponent(chat)}/files/${encodeURIComponent(id)}`);
    const localDev = process.env.NODE_ENV === "development" && ["127.0.0.1", "localhost"].includes(api.hostname);
    if ((api.protocol !== "https:" && !(localDev && api.protocol === "http:")) || api.username || api.password) throw new Error();
  } catch { return fail("download_gateway_not_configured", 503); }
  const hosts = options.storageHosts ?? (process.env.ATTACHMENT_DOWNLOAD_STORAGE_HOSTS || "").split(",").map(v => v.trim()).filter(Boolean);
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const abort = () => {
    controller.abort();
    // Explicitly cancel a pending body read as well as the upstream request.
    void bodyReader?.cancel().catch(() => {});
  };
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  let timer = setTimeout(abort, 10_000);
  const cleanup = () => { clearTimeout(timer); bodyReader = undefined; request.signal.removeEventListener("abort", abort); };
  let phase = "authorization";
  try {
    const metadata = await fetcher(api, { headers: { Authorization: auth, Accept: "application/json" },
      redirect: "error", cache: "no-store", signal: controller.signal });
    if (!metadata.ok) {
      await metadata.body?.cancel(); cleanup();
      return fail("attachment_authorization_rejected", [401, 403, 404, 410, 429].includes(metadata.status) ? metadata.status : 502);
    }
    let file = metadata;
    let filename: unknown = id;
    if ((metadata.headers.get("content-type") || "").includes("application/json")) {
      phase = "metadata";
      if (!metadata.body) throw new Error();
      const reader = metadata.body.getReader();
      bodyReader = reader;
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_METADATA) { await reader.cancel(); throw new Error(); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      bodyReader = undefined;
      reader.releaseLock();
      const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string") throw new Error();
      const signed = new URL(body.url);
      if (!allowedAttachmentStorage(signed, hosts)) { cleanup(); return fail("attachment_storage_host_not_allowed", 502); }
      filename = "filename" in body ? body.filename : id;
      phase = "storage";
      // The caller token is only sent to the trusted authorization API, never storage.
      file = await fetcher(signed, { redirect: "error", cache: "no-store", credentials: "omit", signal: controller.signal });
    }
    if (!file.ok || !file.body) { await file.body?.cancel(); cleanup(); return fail("attachment_storage_unavailable", 502); }
    const length = file.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) {
      await file.body.cancel(); cleanup(); return fail("attachment_too_large", 413);
    }
    clearTimeout(timer);
    timer = setTimeout(abort, 60_000);
    const reader = file.body.getReader();
    bodyReader = reader;
    let transferred = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          if (controller.signal.aborted) throw new Error();
          const part = await reader.read();
          if (controller.signal.aborted) throw new Error();
          if (part.done) { cleanup(); output.close(); return; }
          transferred += part.value.byteLength;
          if (transferred > MAX_BYTES) { await reader.cancel(); throw new Error(); }
          output.enqueue(part.value);
        } catch {
          cleanup(); controller.abort(); output.error(new Error("Attachment transfer failed"));
        }
      },
      cancel() { cleanup(); controller.abort(); return reader.cancel(); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "application/octet-stream", "Content-Disposition": disposition(filename),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    cleanup(); controller.abort();
    return fail(phase === "authorization" ? "attachment_authorization_unreachable"
      : phase === "metadata" ? "attachment_metadata_invalid" : "attachment_storage_unreachable", 502);
  }
}
