"use client";

import { useEffect, useState } from "react";
import { ownerIdsFromAttachments, parseMessageAttachments } from "./mailbox";
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

type OwnerFile = {
  id: string;
  url: string;
  remote: boolean;
  contentType: string;
  name: string;
  byteSize?: number;
};

function sizeLabel(byteSize: number): string {
  return byteSize < 1024 ? `${byteSize} B` : `${(byteSize / 1024).toFixed(1)} KB`;
}

/**
 * Person files (`upl:`) on a sent message. Mailbox thumbs only draw `mbx:`.
 * No listed price — these uploads are not hunter pieces.
 */
export function OwnerFileThumbs({
  chatId,
  attachments,
  gatewayBaseUrl,
  getAccessToken,
  loadingLabel = "Loading attachment…",
  downloadLabel = "Download",
  preparingDownloadLabel = "Preparing download…",
  downloadFailedLabel = "Download failed. Please retry.",
  loadFailedLabel = "Attachment failed to load",
  retryLabel = "Retry",
  unavailableLabel = "Attachment not found or no longer available",
  accessDeniedLabel = "Cannot access attachment. Check your login and chat access.",
}: {
  chatId: string;
  attachments?: string[] | string | null;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  loadingLabel?: string;
  downloadLabel?: string;
  preparingDownloadLabel?: string;
  downloadFailedLabel?: string;
  loadFailedLabel?: string;
  retryLabel?: string;
  unavailableLabel?: string;
  accessDeniedLabel?: string;
}) {
  const ids = ownerIdsFromAttachments(parseMessageAttachments(attachments ?? []));
  const [files, setFiles] = useState<OwnerFile[]>([]);
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
      const next: OwnerFile[] = [];
      const failed: string[] = [];
      const statuses: Record<string, number> = {};
      for (const id of ids) {
        if (cancelled) return;
        try {
          const res = await fetch(
            joinUrl(
              gatewayBaseUrl,
              `/api/chats/${encodeURIComponent(chatId)}/owner-files/${encodeURIComponent(id)}`,
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
              byte_size?: unknown;
            };
            if (cancelled) return;
            const remoteUrl = typeof body.url === "string" ? body.url : "";
            if (!remoteUrl) {
              failed.push(id);
              continue;
            }
            next.push({
              id,
              url: remoteUrl,
              remote: true,
              contentType: typeof body.content_type === "string" ? body.content_type : "",
              name: typeof body.filename === "string" && body.filename ? body.filename : id,
              byteSize:
                typeof body.byte_size === "number" &&
                Number.isFinite(body.byte_size) &&
                body.byte_size >= 0
                  ? body.byte_size
                  : undefined,
            });
            continue;
          }
          const blob = await res.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          next.push({
            id,
            url,
            remote: false,
            contentType: blob.type || res.headers.get("content-type") || "",
            name: filenameFromDisposition(res.headers.get("content-disposition"), id),
            byteSize: blob.size,
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

  const mediaFailed = (id: string) =>
    setFailedIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
  const pendingIds = chatId
    ? ids.filter((id) => !files.some((f) => f.id === id) && !failedIds.includes(id))
    : [];
  if (ids.length === 0 || (files.length === 0 && failedIds.length === 0 && pendingIds.length === 0)) {
    return null;
  }
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
        <div
          key={`loading-${id}`}
          role="status"
          data-owner-file-id={id}
          data-attachment-loading="true"
          style={{
            padding: 14,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            color: colors.muted,
            fontSize: 13,
          }}
        >
          {loadingLabel}
        </div>
      ))}
      {files.map((f) => {
        if (failedIds.includes(f.id)) return null;
        const endpoint = joinUrl(
          gatewayBaseUrl,
          `/api/chats/${encodeURIComponent(chatId)}/owner-files/${encodeURIComponent(f.id)}`,
        );
        const image = f.contentType.startsWith("image/");
        return (
          <div
            key={f.id}
            data-owner-file-id={f.id}
            style={{
              width: "100%",
              maxWidth: 480,
              overflow: "hidden",
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
              <span
                title={f.name}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.name}
              </span>
              {f.byteSize != null ? (
                <span style={{ fontSize: 11, color: colors.muted, flexShrink: 0 }}>
                  {sizeLabel(f.byteSize)}
                </span>
              ) : null}
            </div>
            {image ? (
              <img
                src={f.url}
                alt={f.name}
                onError={() => mediaFailed(f.id)}
                style={{
                  width: "100%",
                  minHeight: 96,
                  maxHeight: 320,
                  objectFit: "contain",
                  background: "rgba(127,127,127,0.08)",
                  display: "block",
                }}
              />
            ) : null}
            <div style={{ padding: "0 12px 10px" }}>
              {f.remote ? (
                <SignedAttachmentLink
                  endpoint={endpoint}
                  getAccessToken={getAccessToken}
                  name={f.name}
                  label={downloadLabel}
                  preparingLabel={preparingDownloadLabel}
                  failedLabel={downloadFailedLabel}
                  onError={() => {
                    /* Keep a playable preview when only downloading failed. */
                  }}
                />
              ) : (
                <a href={f.url} download={f.name} style={{ fontSize: 13 }}>
                  {downloadLabel}
                </a>
              )}
            </div>
          </div>
        );
      })}
      {failedIds.map((id) => (
        <div
          key={`failed-${id}`}
          data-owner-file-id={id}
          data-http-status={failedStatus[id] || undefined}
          style={{
            fontSize: 12,
            color: colors.muted,
            padding: "8px 10px",
            border: `1px dashed ${colors.border}`,
            borderRadius: 8,
          }}
        >
          {failedStatus[id] === 404 || failedStatus[id] === 410
            ? unavailableLabel
            : failedStatus[id] === 401 || failedStatus[id] === 403
              ? accessDeniedLabel
              : loadFailedLabel}
        </div>
      ))}
      {failedIds.length > 0 ? (
        <button
          type="button"
          onClick={() => setRetryCount((n) => n + 1)}
          style={{
            alignSelf: "flex-start",
            color: "inherit",
            cursor: "pointer",
            minHeight: 44,
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: "transparent",
          }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
