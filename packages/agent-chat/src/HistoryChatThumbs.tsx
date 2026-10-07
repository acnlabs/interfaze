"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { isReadableAttachmentName } from "./mailbox";

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export type HistoryFilePreview = {
  attachment_id: string;
  content_type: string;
  filename?: string | null;
  listed_credits?: number;
};

type Thumb = {
  url: string;
  contentType: string;
  mailboxId: string;
  remote?: boolean;
};

function isThumbType(contentType: string): boolean {
  const ct = (contentType || "").toLowerCase();
  if (!ct) return true;
  return ct.startsWith("image/") || ct.startsWith("video/");
}

export function fileTileLabel(file: HistoryFilePreview): string {
  const name = (file.filename || "").trim();
  if (name && isReadableAttachmentName(name, file.attachment_id)) return name;
  const ct = (file.content_type || "").toLowerCase();
  if (ct.startsWith("audio/")) return "Audio";
  if (ct.startsWith("image/")) return "Image";
  if (ct.startsWith("video/")) return "Video";
  if (ct.includes("pdf")) return "PDF";
  if (ct.includes("zip")) return "Zip";
  return "File";
}

export function HistoryChatThumbs({
  chatId,
  files,
  gatewayBaseUrl,
  getAccessToken,
  onPick,
  thumbSize = 40,
  compact = false,
}: {
  chatId: string;
  files: HistoryFilePreview[];
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  onPick: (mailboxId: string, event: MouseEvent<HTMLButtonElement>) => void;
  thumbSize?: number;
  compact?: boolean;
}) {
  const ids = files.filter((f) => isThumbType(f.content_type)).map((f) => f.attachment_id);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [broken, setBroken] = useState<Record<string, true>>({});

  useEffect(() => {
    if (ids.length === 0 || !chatId) {
      setThumbs([]);
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    const controller = new AbortController();
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const next: Thumb[] = [];
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
          if (!res.ok) continue;
          const headerType = (res.headers?.get("content-type") || "").toLowerCase();
          if (headerType.includes("application/json")) {
            const body = (await res.json()) as { url?: unknown; content_type?: unknown };
            const remoteUrl = typeof body.url === "string" ? body.url : "";
            if (!remoteUrl) continue;
            const remoteType = typeof body.content_type === "string" ? body.content_type : "";
            if (remoteType && !remoteType.startsWith("image/") && !remoteType.startsWith("video/")) {
              continue;
            }
            next.push({
              url: remoteUrl,
              remote: true,
              contentType: remoteType,
              mailboxId: id,
            });
            continue;
          }
          const blob = await res.blob();
          const blobType = blob.type || res.headers.get("content-type") || "";
          if (
            blobType &&
            !blobType.startsWith("image/") &&
            !blobType.startsWith("video/") &&
            !blobType.includes("application/json")
          ) {
            continue;
          }
          const url = URL.createObjectURL(blob);
          created.push(url);
          next.push({
            url,
            contentType: blobType,
            mailboxId: id,
          });
        } catch {
          /* keep the named tile; locate still works */
        }
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
      controller.abort();
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [chatId, gatewayBaseUrl, getAccessToken, ids.join("|")]);

  const byId = new Map(thumbs.map((t) => [t.mailboxId, t]));
  const tiles = compact ? files : files.filter((f) => byId.has(f.attachment_id)).slice(0, 3);
  if (tiles.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: compact ? "wrap" : undefined, gap: compact ? 8 : 4, marginTop: compact ? 0 : 6 }}>
      {tiles.map((file) => {
        const thumb = broken[file.attachment_id] ? undefined : byId.get(file.attachment_id);
        const video = Boolean(thumb?.contentType.startsWith("video/"));
        return (
          <button
            key={file.attachment_id}
            type="button"
            onClick={(event) => onPick(file.attachment_id, event)}
            aria-label={fileTileLabel(file)}
            title={file.filename || file.attachment_id}
            style={{
              width: thumbSize,
              height: thumbSize,
              padding: thumb ? 0 : 8,
              border: "none",
              borderRadius: 6,
              overflow: "hidden",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: 11,
              textAlign: "left",
              lineHeight: 1.25,
            }}
          >
            {thumb ? (
              video ? (
                <video
                  src={thumb.url}
                  muted
                  playsInline
                  preload="metadata"
                  onError={() => setBroken((prev) => ({ ...prev, [file.attachment_id]: true }))}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <img
                  src={thumb.url}
                  alt=""
                  onError={() => setBroken((prev) => ({ ...prev, [file.attachment_id]: true }))}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              )
            ) : (
              <span
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "break-word",
                }}
              >
                {fileTileLabel(file)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
