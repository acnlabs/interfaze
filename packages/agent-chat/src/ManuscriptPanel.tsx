"use client";

import { useEffect, useState } from "react";
import type { GatewayClient } from "./gateway";
import { chatPageLink } from "./chatLink";
import { MAILBOX_PREFIX, mailboxIdsFromAttachments } from "./mailbox";
import { parseTableBody, visibleManuscriptBlocks, type ManuscriptBlock } from "./manuscriptPage";
import type { RanchLocale } from "./ranch-shell/i18n";
import { colors } from "./ranch-shell/styles";

const copy = {
  en: {
    title: "Canvas",
    close: "Close",
    empty: "Nothing on this Canvas yet.",
    loadFailed: "Couldn’t load this Canvas.",
    fileFailed: "Couldn’t load this file.",
    tableFailed: "This table can’t be read.",
    point: "Point at this",
    pointing: "Pointing",
    share: "Copy link",
    shared: "Copied",
    shareHint: "Only people in this chat can open this",
  },
  zh: {
    title: "Canvas",
    close: "关闭",
    empty: "这个 Canvas 上还没有内容。",
    loadFailed: "这个 Canvas 暂时读不出来。",
    fileFailed: "这个文件暂时读不出来。",
    tableFailed: "这个表格读不出来。",
    point: "指向这一块",
    pointing: "已指向",
    share: "复制链接",
    shared: "已复制",
    shareHint: "只有这场对话里的人能打开",
  },
} as const;

function IconPoint() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 3.5l7.2 16.2 1.7-6.4 6.6-1.6L4 3.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function mailboxIdFromBody(body: string): string | null {
  const text = body.trim();
  const ids = mailboxIdsFromAttachments([text]);
  if (ids.length !== 1 || text !== `${MAILBOX_PREFIX}${ids[0]}`) return null;
  return ids[0];
}

function MediaBlock({
  client,
  chatId,
  attachmentId,
  kind,
  failedLabel,
}: {
  client: GatewayClient;
  chatId: string;
  attachmentId: string;
  kind: "image" | "video";
  failedLabel: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let gone = false;
    let revoke = () => {};
    setUrl(null);
    setFailed(false);
    client
      .openChatFile(chatId, attachmentId)
      .then((file) => {
        if (gone) {
          file.revoke();
          return;
        }
        revoke = file.revoke;
        setUrl(file.url);
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
      revoke();
    };
  }, [attachmentId, chatId, client]);

  if (failed) {
    return <p style={{ margin: 0, padding: 14, color: colors.muted }}>{failedLabel}</p>;
  }
  if (!url) return null;
  if (kind === "video") {
    return (
      <video src={url} controls playsInline style={{ width: "100%", display: "block", background: "#000" }} />
    );
  }
  return <img src={url} alt="" style={{ maxWidth: "100%", display: "block" }} />;
}

function TableBlock({ body, failedLabel }: { body: string; failedLabel: string }) {
  const table = parseTableBody(body);
  if (!table) {
    return <p style={{ margin: 0, padding: 14, color: colors.muted }}>{failedLabel}</p>;
  }
  return (
    <div style={{ overflow: "auto", padding: 14 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            {table.columns.map((column, index) => (
              <th
                key={`${index}:${column}`}
                style={{
                  textAlign: "left",
                  borderBottom: `1px solid ${colors.border}`,
                  padding: "8px 10px",
                  fontWeight: 650,
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: "8px 10px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.54.54l2.12-2.12a5 5 0 0 0-7.07-7.07L11.2 5.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54L4.34 12.6a5 5 0 0 0 7.07 7.07l1.39-1.39"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShareButton({
  chatId,
  blockKey,
  label,
  copiedLabel,
  hint,
}: {
  chatId: string;
  blockKey?: string | null;
  label: string;
  copiedLabel: string;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : hint}
      onClick={() => {
        const link = chatPageLink(window.location.origin, chatId, blockKey);
        void navigator.clipboard.writeText(link).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      style={{
        border: `1px solid ${colors.border}`,
        background: "transparent",
        color: colors.text,
        borderRadius: 8,
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <IconLink />
    </button>
  );
}

function PointButton({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        border: `1px solid ${pressed ? colors.accent : colors.border}`,
        background: pressed ? colors.accentSoft : "transparent",
        color: colors.text,
        borderRadius: 8,
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <IconPoint />
    </button>
  );
}

export function ManuscriptPanel({
  client,
  chatId,
  threadId,
  locale,
  reloadToken,
  onClose,
  embedded = false,
  blockKey,
  pointedKey,
  onPoint,
}: {
  client: GatewayClient;
  chatId: string;
  threadId: string | null;
  locale: RanchLocale;
  reloadToken: number;
  onClose: () => void;
  embedded?: boolean;
  blockKey?: string;
  pointedKey?: string | null;
  onPoint?: (block: ManuscriptBlock) => void;
}) {
  const t = copy[locale] ?? copy.en;
  const [blocks, setBlocks] = useState<ManuscriptBlock[] | null>(null);
  const [failed, setFailed] = useState(false);
  const shown = blocks ? (blockKey ? blocks.filter((block) => block.block_key === blockKey) : blocks) : null;
  const pointedBlock = shown?.length === 1 ? shown[0] : null;

  useEffect(() => {
    let gone = false;
    setFailed(false);
    client
      .getChatPage(chatId)
      .then((page) => {
        if (!gone) setBlocks(visibleManuscriptBlocks(page.blocks ?? [], threadId));
      })
      .catch(() => {
        if (!gone) {
          setBlocks(null);
          setFailed(true);
        }
      });
    return () => {
      gone = true;
    };
  }, [client, chatId, threadId, reloadToken]);

  return (
    <div
      style={{
        ...(embedded
          ? { flex: 1, minHeight: 0, height: "100%" }
          : { position: "absolute", inset: 0, zIndex: 40 }),
        background: colors.bg,
        color: colors.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {embedded ? null : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <strong style={{ flex: 1 }}>{t.title}</strong>
          <button type="button" onClick={onClose} style={{ background: "transparent", color: colors.muted, border: 0 }}>
            {t.close}
          </button>
        </div>
      )}
      {pointedBlock && onPoint ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "6px 8px",
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <ShareButton
            chatId={chatId}
            blockKey={pointedBlock.block_key}
            label={t.share}
            copiedLabel={t.shared}
            hint={t.shareHint}
          />
          <PointButton
            pressed={pointedKey === pointedBlock.block_key}
            label={pointedKey === pointedBlock.block_key ? t.pointing : t.point}
            onClick={() => onPoint(pointedBlock)}
          />
        </div>
      ) : null}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: embedded ? 0 : 14,
          display: "flex",
          flexDirection: "column",
          gap: embedded ? 0 : 16,
        }}
      >
        {failed ? <p style={{ margin: 0, padding: 14, color: colors.muted }}>{t.loadFailed}</p> : null}
        {shown && shown.length === 0 ? <p style={{ margin: 0, padding: 14, color: colors.muted }}>{t.empty}</p> : null}
        {shown?.map((block) => (
          <section
            key={block.block_key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: embedded ? 1 : undefined,
              minHeight: embedded ? 0 : undefined,
            }}
          >
            {onPoint && !pointedBlock ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <PointButton
                  pressed={pointedKey === block.block_key}
                  label={pointedKey === block.block_key ? t.pointing : t.point}
                  onClick={() => onPoint(block)}
                />
              </div>
            ) : null}
            {block.type === "html" ? (
              <iframe
                title={block.title?.trim() || block.block_key}
                sandbox="allow-scripts"
                srcDoc={block.body}
                style={{
                  width: "100%",
                  height: embedded ? "100%" : 360,
                  minHeight: embedded ? 0 : 320,
                  flex: embedded ? 1 : undefined,
                  border: embedded ? 0 : `1px solid ${colors.border}`,
                  borderRadius: embedded ? 0 : 8,
                  background: "#fff",
                }}
              />
            ) : block.type === "table" ? (
              <TableBlock body={block.body} failedLabel={t.tableFailed} />
            ) : block.type === "image" || block.type === "video" ? (
              mailboxIdFromBody(block.body) ? (
                <MediaBlock
                  client={client}
                  chatId={chatId}
                  attachmentId={mailboxIdFromBody(block.body) as string}
                  kind={block.type}
                  failedLabel={t.fileFailed}
                />
              ) : (
                <p style={{ margin: 0, padding: 14, color: colors.muted }}>{t.fileFailed}</p>
              )
            ) : (
              <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, padding: embedded ? 14 : 0 }}>
                {block.body}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
