export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "break" };

export type MarkdownBlock =
  | { type: "paragraph"; inlines: MarkdownInline[] }
  | { type: "heading"; level: number; inlines: MarkdownInline[] }
  | { type: "list"; ordered: boolean; items: MarkdownInline[][] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "code"; text: string }
  | { type: "gap" };

const INLINE_RE = /(`[^`\n]+`)|(\*\*([^*]+)\*\*)|(__(.+?)__)/g;

function parseInlines(line: string): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  INLINE_RE.lastIndex = 0;
  let last = 0;
  for (const match of line.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: line.slice(last, index) });
    if (match[1]) out.push({ type: "code", text: match[1].slice(1, -1) });
    else if (match[3]) out.push({ type: "strong", text: match[3] });
    else if (match[5]) out.push({ type: "strong", text: match[5] });
    last = index + match[0].length;
  }
  if (last < line.length) out.push({ type: "text", text: line.slice(last) });
  if (out.length === 0) out.push({ type: "text", text: "" });
  return out;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((cell) => cell.trim());
}

function listMarker(line: string): { ordered: boolean; text: string } | null {
  const match = /^(\s*)(?:[-*]|(\d+)[.)])\s+(.*)$/.exec(line);
  if (!match) return null;
  return { ordered: Boolean(match[2]), text: match[3] ?? "" };
}

function headingOf(line: string): { level: number; text: string } | null {
  const match = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
  if (!match) return null;
  return { level: match[1]!.length, text: match[2] ?? "" };
}

function isFence(line: string): boolean {
  return /^\s*```/.test(line);
}

/** Chat markdown: bold, inline code, lists, and tables. Text stays text — no HTML. */
export function parseMessageMarkdown(source: string | null | undefined): MarkdownBlock[] {
  const text = (source || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      const hasMore = lines.slice(index + 1).some((item) => item.trim());
      if (hasMore && blocks.length > 0) blocks.push({ type: "gap" });
      index += 1;
      continue;
    }
    if (isFence(line)) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !isFence(lines[index] ?? "")) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    if (isTableRow(line)) {
      const raw: string[][] = [];
      while (index < lines.length && isTableRow(lines[index] ?? "")) {
        const row = lines[index] ?? "";
        if (!isSeparatorRow(row)) raw.push(splitRow(row));
        index += 1;
      }
      if (raw.length > 0) {
        blocks.push({ type: "table", header: raw[0] ?? [], rows: raw.slice(1) });
      }
      continue;
    }
    const heading = headingOf(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading.level, inlines: parseInlines(heading.text) });
      index += 1;
      continue;
    }
    const marker = listMarker(line);
    if (marker) {
      const ordered = marker.ordered;
      const items: MarkdownInline[][] = [];
      while (index < lines.length) {
        const next = listMarker(lines[index] ?? "");
        if (!next || next.ordered !== ordered) break;
        items.push(parseInlines(next.text));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const inlines: MarkdownInline[] = [];
    while (index < lines.length) {
      const next = lines[index] ?? "";
      if (!next.trim() || isFence(next) || isTableRow(next) || listMarker(next) || headingOf(next)) break;
      if (inlines.length > 0) inlines.push({ type: "break" });
      inlines.push(...parseInlines(next));
      index += 1;
    }
    blocks.push({ type: "paragraph", inlines });
  }

  return blocks;
}
