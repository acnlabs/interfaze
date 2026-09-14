"use client";

import { useEffect, useState } from "react";
import { mailboxIdsFromAttachments, parseMessageAttachments } from "./mailbox";

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

type FileBlob = { url: string; contentType: string; name: string };

export function MailboxThumbs({
  chatId,
  attachments,
  gatewayBaseUrl,
  getAccessToken,
}: {
  chatId: string;
  attachments?: string[] | string | null;
  gatewayBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const ids = mailboxIdsFromAttachments(parseMessageAttachments(attachments ?? []));
  const [files, setFiles] = useState<FileBlob[]>([]);

  useEffect(() => {
    if (ids.length === 0 || !chatId) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const next: FileBlob[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(
            joinUrl(
              gatewayBaseUrl,
              `/api/chats/${encodeURIComponent(chatId)}/files/${encodeURIComponent(id)}`,
            ),
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!res.ok) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          created.push(url);
          const contentType = blob.type || res.headers.get("content-type") || "";
          next.push({
            url,
            contentType,
            name: filenameFromDisposition(
              res.headers.get("content-disposition"),
              id,
            ),
          });
        } catch {
          /* skip broken blob */
        }
      }
      if (!cancelled) setFiles(next);
    })();
    return () => {
      cancelled = true;
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [chatId, gatewayBaseUrl, getAccessToken, ids.join("|")]);

  if (files.length === 0) return null;
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
      {files.map((f) =>
        f.contentType.startsWith("video/") ? (
          <video
            key={f.url}
            src={f.url}
            controls
            playsInline
            style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
          />
        ) : f.contentType.startsWith("audio/") ? (
          <audio
            key={f.url}
            src={f.url}
            controls
            style={{ width: "100%", display: "block" }}
          />
        ) : f.contentType.startsWith("image/") ? (
          <img
            key={f.url}
            src={f.url}
            alt=""
            style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
          />
        ) : (
          <a
            key={f.url}
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
        ),
      )}
    </div>
  );
}
