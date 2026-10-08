/** Blocks on a chat Canvas. The shell reads these from GET /canvas. */

export type ManuscriptBlock = {
  block_key: string;
  type: "text" | "html" | "table" | "image" | "video";
  title?: string | null;
  body: string;
  rev: number;
  creator_agent_id: string;
  updated_by_agent_id: string;
  thread_id?: string | null;
};

export type TableBody = {
  columns: string[];
  rows: string[][];
};

/** The body stored for a table block. Null when it is not that JSON. */
export function parseTableBody(body: string): TableBody | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(record.columns) || !Array.isArray(record.rows)) return null;
  if (record.columns.length === 0 || record.columns.some((cell) => typeof cell !== "string")) return null;
  const width = record.columns.length;
  const rows: string[][] = [];
  for (const row of record.rows) {
    if (!Array.isArray(row) || row.length !== width || row.some((cell) => typeof cell !== "string")) {
      return null;
    }
    rows.push(row);
  }
  return { columns: record.columns, rows };
}

export type ManuscriptPage = {
  chat_id: string;
  blocks: ManuscriptBlock[];
};

/** Main timeline shows blocks with no topic. A topic shows only its own blocks. */
export function visibleManuscriptBlocks(
  blocks: ManuscriptBlock[],
  threadId: string | null,
): ManuscriptBlock[] {
  if (threadId) return blocks.filter((block) => block.thread_id === threadId);
  return blocks.filter((block) => !block.thread_id);
}
