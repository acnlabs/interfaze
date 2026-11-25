import { parseMessageAttachments } from "./mailbox";

export type ImageBox = {
  ref: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

function edge(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

/** The one box this turn may draw. Anything else stays recorded and hidden. */
export function shownImageBox(meta: unknown): ImageBox | null {
  if (!meta || typeof meta !== "object") return null;
  const orch = (meta as { orchestration?: unknown }).orchestration;
  if (!orch || typeof orch !== "object") return null;
  const decide = (orch as { decide?: unknown }).decide;
  if (!decide || typeof decide !== "object") return null;
  const shadow = (decide as { shadow?: unknown }).shadow;
  if (!shadow || typeof shadow !== "object") return null;
  const boxes = (shadow as { boxes?: unknown }).boxes;
  if (!boxes || typeof boxes !== "object") return null;
  const shown: ImageBox[] = [];
  for (const row of Object.values(boxes as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (item.shown !== true || typeof item.image !== "string") continue;
    const top = edge(item.top);
    const bottom = edge(item.bottom);
    const left = edge(item.left);
    const right = edge(item.right);
    const ref = item.image.trim();
    if (top == null || bottom == null || left == null || right == null) continue;
    if (!ref || left >= right || top >= bottom) continue;
    shown.push({ ref, top, bottom, left, right });
  }
  return shown.length === 1 ? shown[0] : null;
}

/** Draw a box on the picture it names, even when the answer is stored on the reply. */
export function shownImageBoxFor(
  messages: readonly { metadata?: unknown }[],
  attachments: unknown,
): ImageBox | null {
  const refs = new Set(parseMessageAttachments(attachments));
  if (refs.size === 0) return null;
  const hits = new Map<string, ImageBox>();
  for (const message of messages) {
    const box = shownImageBox(message?.metadata);
    if (!box || !refs.has(box.ref)) continue;
    hits.set(`${box.ref}:${box.top}:${box.bottom}:${box.left}:${box.right}`, box);
  }
  return hits.size === 1 ? [...hits.values()][0] : null;
}

export function imageBoxFrameStyle(box: ImageBox): Record<string, string> {
  return {
    position: "absolute",
    left: `${box.left * 100}%`,
    top: `${box.top * 100}%`,
    width: `${(box.right - box.left) * 100}%`,
    height: `${(box.bottom - box.top) * 100}%`,
    border: "2px solid #e2b340",
    boxSizing: "border-box",
    pointerEvents: "none",
  };
}
