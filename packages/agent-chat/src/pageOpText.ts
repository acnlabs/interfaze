export type PageOpRecord = {
  actor_id?: string;
  action?: string;
  outcome?: string;
  reason?: string;
  block_key?: string;
  rev?: number;
  topic_dropped?: boolean;
};

export type PageRefRecord = {
  block_key?: string;
  rev?: number;
  thread_id?: string | null;
  title?: string | null;
};

/** The sentence points at one block. Rendered in the active interface language. */
export function pageRefLine(locale: string | null | undefined, ref: PageRefRecord): string {
  const zh = (locale || "").toLowerCase().startsWith("zh");
  const name = (ref.title || "").trim() || blockLabel(ref.block_key) || (zh ? "这一块" : "this block");
  if (zh) return ref.rev ? `指向「${name}」，第 ${ref.rev} 版` : `指向「${name}」`;
  return ref.rev ? `Pointing at “${name}”, rev ${ref.rev}` : `Pointing at “${name}”`;
}

export function blockLabel(blockKey: string | undefined): string {
  if (!blockKey) return "";
  const idx = blockKey.indexOf(":");
  const name = idx >= 0 ? blockKey.slice(idx + 1) : blockKey;
  return name.trim();
}

/** One operation record, rendered in the active interface language. */
export function pageOpLine(
  locale: string | null | undefined,
  record: PageOpRecord,
  actor: string,
): string {
  const zh = (locale || "").toLowerCase().startsWith("zh");
  const block = blockLabel(record.block_key);
  const rev = record.rev;
  const action = record.action || "write";
  const failed = record.outcome !== "ok";
  if (!failed) {
    const kept = zh
      ? block
        ? action === "create"
          ? `${actor} 在 Canvas 上新增了「${block}」，第 ${rev} 版。`
          : `${actor} 更新了 Canvas 上的「${block}」，第 ${rev} 版。`
        : action === "create"
          ? `${actor} 在 Canvas 上新增了一块，第 ${rev} 版。`
          : `${actor} 更新了 Canvas，第 ${rev} 版。`
      : block
        ? action === "create"
          ? `${actor} added “${block}” to the Canvas, rev ${rev}.`
          : `${actor} updated “${block}” on the Canvas, rev ${rev}.`
        : action === "create"
          ? `${actor} added a block to the Canvas, rev ${rev}.`
          : `${actor} updated the Canvas, rev ${rev}.`;
    if (!record.topic_dropped) return kept;
    return zh
      ? `${kept.slice(0, -1)}，话题不在这场对话里，所以放在主时间线上。`
      : `${kept.slice(0, -1)}. The topic is not in this chat, so it stays on the main timeline.`;
  }
  const zhLine: Record<string, string> = {
    conflict: `${actor} 想更新 Canvas，但这块刚被改过。`,
    exists: `${actor} 想在 Canvas 上新增一块，但这块已经有了。`,
    not_found: `${actor} 想更新 Canvas，但这块不在上面。`,
    bad_topic: `${actor} 想把 Canvas 放进一个不在这场对话里的话题。`,
    no_text: `${actor} 只给了 Canvas、没有正文，所以没有发出去。`,
    missing_rev: `${actor} 想更新 Canvas，但没有带上当前版本。`,
    unexpected_rev: `${actor} 想在 Canvas 上新增一块，但新块不该带版本号。`,
    empty: `${actor} 想改 Canvas，但正文是空的。`,
    too_long: `${actor} 想改 Canvas，但这篇太长了。`,
    bad_type: `${actor} 想改 Canvas，但这种内容上面还不能放。`,
    bad_name: `${actor} 想改 Canvas，但块的名字不能用。`,
    bad_file: `${actor} 想在 Canvas 上放一个文件，但这场对话里没有这个文件，或种类不对。`,
    invalid: `${actor} 想改 Canvas，但这次写入被拒绝了。`,
  };
  const enLine: Record<string, string> = {
    conflict: `${actor} tried to update the Canvas, but that block was just changed.`,
    exists: `${actor} tried to add a block to the Canvas, but it already exists.`,
    not_found: `${actor} tried to update a block that is not on this Canvas.`,
    bad_topic: `${actor} tried to put the Canvas in a topic that is not in this chat.`,
    no_text: `${actor} sent a Canvas without any text, so nothing was posted.`,
    missing_rev: `${actor} tried to update the Canvas without the current version.`,
    unexpected_rev: `${actor} tried to add a block to the Canvas, but a new block has no version.`,
    empty: `${actor} tried to change the Canvas, but the text was empty.`,
    too_long: `${actor} tried to change the Canvas, but it was too long.`,
    bad_type: `${actor} tried to change the Canvas, but that kind of block is not allowed.`,
    bad_name: `${actor} tried to change the Canvas, but the block name cannot be used.`,
    bad_file: `${actor} tried to put a file on the Canvas, but that file is not in this chat or is the wrong kind.`,
    invalid: `${actor} tried to change the Canvas, but the write was rejected.`,
  };
  const table = zh ? zhLine : enLine;
  const reason = record.reason || "invalid";
  const line = table[reason] || table.invalid;
  if (!block || reason === "no_text") return line;
  return zh ? `${line.slice(0, -1)}（${block}）。` : `${line.slice(0, -1)} (${block}).`;
}
