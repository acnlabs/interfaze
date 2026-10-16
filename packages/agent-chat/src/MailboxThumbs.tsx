"use client";

import { useEffect, useState } from "react";
import { mailboxIdsFromAttachments, parseMessageAttachments, isReadableAttachmentName } from "./mailbox";
import { colors } from "./ranch-shell/styles";
import { SignedAttachmentLink } from "./SignedAttachmentLink";

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      /* keep fallback */
    }
  }
  const ascii = /filename="?([^";]+)"?/i.exec(header);
  return ascii?.[1]?.trim() || fallback;
}

function listedFromHeader(header: string | null): number {
  if (!header) return 0;
  const n = Number(header.trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100_000, Math.floor(n));
}

type FileBlob = {
  url: string;
  contentType: string;
  name: string;
  mailboxId: string;
  listedCredits: number;
  retainUntil?: string | null;
  remote?: boolean;
  byteSize?: number;
};

function retainLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString();
}

function ListedTag({ n, label }: { n: number; label: (amount: number) => string }) {
  if (n <= 0) return null;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        fontSize: 12,
        lineHeight: 1.4,
        pointerEvents: "none",
      }}
    >
      {label(n)}
    </div>
  );
}

export function MailboxThumbs({
  chatId,
  attachments,
  gatewayBaseUrl,
  getAccessToken,
  showListedPrice = false,
  chargedMailboxIds = null,
  loadingLabel = "Loading attachment…",
  preparingDownloadLabel = "Preparing download…",
  downloadLabel = "Download",
  downloadFailedLabel = "Download failed. Please retry.",
  attachmentDownloadProxy,
  availableUntilLabel = "Available until",
  loadFailedLabel = "Attachment failed to load",
  retryLabel = "Retry",
  unavailableLabel = "Attachment not found or no longer available",
  accessDeniedLabel = "Cannot access attachment. Check your login and chat access.",
  listedPriceLabel = (amount: number) => `${amount} Credits`,
}: {
  chatId: string;
  attachments?: string[] | string | null;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /** True only when this hop's charge has settled. */
  showListedPrice?: boolean;
  /** Files this settled charge covered. Null keeps the older all-files behavior. */
  chargedMailboxIds?: string[] | null;
  loadingLabel?: string;
  preparingDownloadLabel?: string;
  downloadLabel?: string;
  downloadFailedLabel?: string;
  attachmentDownloadProxy?: string;
  availableUntilLabel?: string;
  loadFailedLabel?: string;
  retryLabel?: string;
  unavailableLabel?: string;
  accessDeniedLabel?: string;
  listedPriceLabel?: (amount: number) => string;
}) {
  const ids = mailboxIdsFromAttachments(parseMessageAttachments(attachments ?? []));
  const [files, setFiles] = useState<FileBlob[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [failedStatus, setFailedStatus] = useState<Record<string, number>>({});

  useEffect(() => {
    if (ids.length === 0 || !chatId) {
      setFiles([]);
      setFailedIds([]);
      setFailedStatus({});
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const created: string[] = [];
    setFiles([]);
    setFailedIds([]);
    setFailedStatus({});
    (async () => {
      let token: string | null;
      try {
        token = await getAccessToken();
      } catch {
        if (!cancelled) setFailedIds(ids);
        return;
      }
      if (cancelled) return;
      if (!token) {
        setFailedIds(ids);
        return;
      }
      const next: FileBlob[] = [];
      const failed: string[] = [];
      const statuses: Record<string, number> = {};
      for (const id of ids) {
        if (cancelled) return;
        try {
          const res = await fetch(
            joinUrl(
              gatewayBaseUrl,
              `/api/chats/${encodeURIComponent(chatId)}/files/${encodeURIComponent(id)}`,
            ),
            { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
          );
          if (cancelled) return;
          if (!res.ok) {
            failed.push(id);
            statuses[id] = res.status;
            continue;
          }
          const headerType = (res.headers?.get("content-type") || "").toLowerCase();
          if (headerType.includes("application/json")) {
            const body = (await res.json()) as {
              url?: unknown;
              content_type?: unknown;
              filename?: unknown;
              listed_credits?: unknown;
              retain_until?: unknown;
              byte_size?: unknown;
            };
            if (cancelled) return;
            const remoteUrl = typeof body.url === "string" ? body.url : "";
            if (!remoteUrl) {
              failed.push(id);
              continue;
            }
            next.push({
              url: remoteUrl,
              remote: true,
              contentType: typeof body.content_type === "string" ? body.content_type : "",
              mailboxId: id,
              name: typeof body.filename === "string" && body.filename ? body.filename : id,
              listedCredits:
                typeof body.listed_credits === "number"
                  ? Math.min(100_000, Math.max(0, Math.floor(body.listed_credits)))
                  : listedFromHeader(String(body.listed_credits ?? "")),
              retainUntil: typeof body.retain_until === "string" ? body.retain_until : null,
              byteSize: typeof body.byte_size === "number" && Number.isFinite(body.byte_size) && body.byte_size >= 0 ? body.byte_size : undefined,
            });
            continue;
          }
          const blob = await res.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          const contentType = blob.type || res.headers.get("content-type") || "";
          next.push({
            url,
            contentType,
            byteSize: blob.size,
            mailboxId: id,
            name: filenameFromDisposition(
              res.headers.get("content-disposition"),
              id,
            ),
            listedCredits: listedFromHeader(
              res.headers.get("X-Piece-Listed-Credits") ||
                res.headers.get("x-piece-listed-credits"),
            ),
          });
        } catch {
          failed.push(id);
        }
      }
      if (!cancelled) {
        setFiles(next);
        setFailedIds(failed);
        setFailedStatus(statuses);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [chatId, gatewayBaseUrl, getAccessToken, ids.join("|"), retryCount]);

  const visible = files.filter((f) => {
    const playable =
      f.contentType.startsWith("video/") ||
      f.contentType.startsWith("audio/") ||
      f.contentType.startsWith("image/");
    return playable || isReadableAttachmentName(f.name, f.mailboxId);
  });
  const mediaFailed = (id: string) => setFailedIds((previous) =>
    previous.includes(id) ? previous : [...previous, id]);
  const pendingIds = chatId ? ids.filter((id) => !files.some((f) => f.mailboxId === id) && !failedIds.includes(id)) : [];
  if (visible.length === 0 && failedIds.length === 0 && pendingIds.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: 8,
        maxWidth: "100%",
      }}
    >
      {pendingIds.map((id) => (
        <div key={`loading-${id}`} role="status" data-mailbox-id={id} data-attachment-loading="true"
          style={{ padding: 14, border: `1px solid ${colors.border}`, borderRadius: 12, color: colors.muted, fontSize: 13 }}>
          <span aria-hidden="true">◌ </span>{loadingLabel}
        </div>
      ))}
      {visible.map((f) => {
        if (failedIds.includes(f.mailboxId)) return null;
        const playable =
          f.contentType.startsWith("video/") ||
          f.contentType.startsWith("audio/") ||
          f.contentType.startsWith("image/");
        if (playable) {
          const media = f.contentType.startsWith("video/") ? (
            <video
              src={f.url}
              onError={() => mediaFailed(f.mailboxId)}
              controls
              playsInline
              controlsList="nodownload"
              preload="metadata"
              aria-label={f.name}
              style={{ width: "100%", minHeight: 160, maxHeight: 320, objectFit: "contain", background: "#0b0d12", display: "block" }}
            />
          ) : f.contentType.startsWith("audio/") ? (
            <audio
              src={f.url}
              onError={() => mediaFailed(f.mailboxId)}
              controls
              controlsList="nodownload"
              preload="metadata"
              aria-label={f.name}
              style={{ width: "100%", display: "block" }}
            />
          ) : (
            <img
              src={f.url}
              onError={() => mediaFailed(f.mailboxId)}
              alt={f.name}
              style={{ width: "100%", minHeight: 96, maxHeight: 320, objectFit: "contain", background: "rgba(127,127,127,0.08)", display: "block" }}
            />
          );
          return (
            <div key={f.url} data-mailbox-id={f.mailboxId} style={{ width: "100%", maxWidth: 480, overflow: "hidden", border: `1px solid ${colors.border}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                <span title={f.name} style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                {f.byteSize != null ? <span style={{ fontSize: 11, color: colors.muted, flexShrink: 0 }}>
                  {f.byteSize < 1024 ? `${f.byteSize} B` : `${(f.byteSize / 1024).toFixed(1)} KB`}
                </span> : null}
              {showListedPrice &&
              (chargedMailboxIds == null || chargedMailboxIds.includes(f.mailboxId)) ? (
                <ListedTag n={f.listedCredits} label={listedPriceLabel} />
              ) : null}
              </div>
              {media}
              <div style={{ padding: "0 12px" }}>
                {f.remote ? <SignedAttachmentLink
                  endpoint={joinUrl(gatewayBaseUrl, `/api/chats/${encodeURIComponent(chatId)}/files/${encodeURIComponent(f.mailboxId)}`)}
                  getAccessToken={getAccessToken} name={f.name} label={downloadLabel} saveAsBlob
                  downloadEndpoint={attachmentDownloadProxy ? `${attachmentDownloadProxy}?chat=${encodeURIComponent(chatId)}&attachment=${encodeURIComponent(f.mailboxId)}` : undefined}
                  preparingLabel={preparingDownloadLabel} failedLabel={downloadFailedLabel}
                  onError={() => { /* Keep a playable preview when only downloading failed. */ }}
                /> : <a href={f.url} download={f.name} style={{ display: "inline-block", padding: "12px 0", fontSize: 13 }}>{downloadLabel}</a>}
              </div>
              {retainLabel(f.retainUntil) ? (
                <div style={{ fontSize: 11, color: colors.muted, padding: "8px 12px" }}>
                  {availableUntilLabel} {retainLabel(f.retainUntil)}
                </div>
              ) : null}
            </div>
          );
        }
        if (!isReadableAttachmentName(f.name, f.mailboxId)) return null;
        return (
          <div key={f.url} data-mailbox-id={f.mailboxId} style={{ padding: "12px 14px", border: `1px solid ${colors.border}`, borderRadius: 12, overflowWrap: "anywhere" }}>
            {f.remote ? <SignedAttachmentLink
              endpoint={joinUrl(gatewayBaseUrl,
                `/api/chats/${encodeURIComponent(chatId)}/files/${encodeURIComponent(f.mailboxId)}`)}
              getAccessToken={getAccessToken} name={f.name}
              preparingLabel={preparingDownloadLabel}
              onError={() => mediaFailed(f.mailboxId)} /> : (
            <a
              href={f.url}
              download={f.name}
              style={{
                fontSize: 13,
                color: "inherit",
                textDecoration: "underline",
                wordBreak: "break-all",
              }}
            >
              {f.name}
            </a>
            )}
            {f.byteSize != null ? <div style={{ marginTop: 6, fontSize: 11, color: colors.muted }}>
              {f.byteSize < 1024 ? `${f.byteSize} B` : `${(f.byteSize / 1024).toFixed(1)} KB`}
            </div> : null}
            {retainLabel(f.retainUntil) ? <div style={{ marginTop: 6, fontSize: 11, color: colors.muted }}>
              {availableUntilLabel} {retainLabel(f.retainUntil)}
            </div> : null}
          </div>
        );
      })}
      {failedIds.map((id) => (
        <div
          key={`failed-${id}`}
          data-mailbox-id={id}
          data-http-status={failedStatus[id] || undefined}
          style={{
            fontSize: 12,
            color: colors.muted,
            padding: "8px 10px",
            border: `1px dashed ${colors.border}`,
            borderRadius: 8,
          }}
        >
          <div style={{ marginBottom: 4, color: "inherit", overflowWrap: "anywhere" }}>
            {files.find((f) => f.mailboxId === id)?.name || `#${ids.indexOf(id) + 1}`}
          </div>
          {failedStatus[id] === 404 || failedStatus[id] === 410
            ? unavailableLabel
            : failedStatus[id] === 401 || failedStatus[id] === 403
              ? accessDeniedLabel
              : loadFailedLabel}
        </div>
      ))}
      {failedIds.length > 0 ? (
        <button type="button" onClick={() => setRetryCount((n) => n + 1)}
          style={{ alignSelf: "flex-start", color: "inherit", cursor: "pointer", minHeight: 44, padding: "8px 14px", borderRadius: 8, border: `1px solid ${colors.border}`, background: "transparent" }}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
