/**
 * Whether a catalog `modality` string accepts image input.
 *
 * OpenRouter uses `text+image->text` / `text->text`. Bare `"text"` from
 * TokenPlus/SiliconFlow sync is not trustworthy — treat as unknown.
 *
 * @returns `true` / `false` when known; `null` when unknown.
 */
export function acceptsImageInput(modality: string | null | undefined): boolean | null {
  const raw = (modality || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("->")) {
    const inp = raw.slice(0, raw.indexOf("->"));
    return inp.includes("image");
  }
  if (raw === "text" || raw === "text-only") return null;
  if (raw.includes("image")) return true;
  return null;
}

/** Image-ish MIME used on owner uploads / wake file parts. */
export function mimeLooksLikeImage(mime: string | null | undefined): boolean {
  const m = (mime || "").trim().toLowerCase();
  return m.startsWith("image/");
}
