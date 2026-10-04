"use client";

import { useEffect, useState } from "react";
import { mailboxIdsFromAttachments, parseMessageAttachments, isReadableAttachmentName } from "./mailbox";
import { colors } from "./ranch-shell/styles";

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
};

function retainLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString();
}

function ListedTag({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 1,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        fontSize: 12,
        lineHeight: 1.4,
        pointerEvents: "none",
      }}
    >
      {n} Credits
    </div>
  );
}

export function MailboxThumbs({
  chatId,
  attachments,
  gatewayBaseUrl,
  getAccessToken,
  loadFailedLabel = "Attachment failed to load",
  retryLabel = "Retry",
  unavailableLabel = "Attachment not found or no longer available",
  accessDeniedLabel = "Cannot access attachment. Check your login and chat access.",
}: {
  chatId: string;
  attachments?: string[] | string | null;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  loadFailedLabel?: string;
  retryLabel?: string;
  unavailableLabel?: string;
  accessDeniedLabel?: string;
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
            };
            if (cancelled) return;
            const remoteUrl = typeof body.url === "string" ? body.url : "";
            if (!remoteUrl) {
              failed.push(id);
              continue;
            }
            next.push({
              url: remoteUrl,
              contentType: typeof body.content_type === "string" ? body.content_type : "",
              mailboxId: id,
              name: typeof body.filename === "string" && body.filename ? body.filename : id,
              listedCredits:
                typeof body.listed_credits === "number"
                  ? Math.min(100_000, Math.max(0, Math.floor(body.listed_credits)))
                  : listedFromHeader(String(body.listed_credits ?? "")),
              retainUntil: typeof body.retain_until === "string" ? body.retain_until : null,
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
  if (visible.length === 0 && failedIds.length === 0) return null;
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
      {visible.map((f) => {
        const playable =
          f.contentType.startsWith("video/") ||
          f.contentType.startsWith("audio/") ||
          f.contentType.startsWith("image/");
        if (playable) {
          const media = f.contentType.startsWith("video/") ? (
            <video
              src={f.url}
              controls
              playsInline
              style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
            />
          ) : f.contentType.startsWith("audio/") ? (
            <audio
              src={f.url}
              controls
              style={{ width: "100%", display: "block" }}
            />
          ) : (
            <img
              src={f.url}
              alt={f.name}
              style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
            />
          );
          return (
            <div key={f.url} style={{ position: "relative", maxWidth: "100%" }}>
              <ListedTag n={f.listedCredits} />
              {media}
              {retainLabel(f.retainUntil) ? (
                <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  {retainLabel(f.retainUntil)}
                </div>
              ) : null}
            </div>
          );
        }
        if (!isReadableAttachmentName(f.name, f.mailboxId)) return null;
        return (
          <div key={f.url}>
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
          </div>
        );
      })}
      {failedIds.map((id) => (
        <div
          key={`failed-${id}`}
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
        <button type="button" onClick={() => setRetryCount((n) => n + 1)}
          style={{ alignSelf: "flex-start", color: "inherit", cursor: "pointer" }}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
