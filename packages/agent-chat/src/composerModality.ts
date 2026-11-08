/**
 * Whether a modality string accepts image input.
 *
 * Trust OpenRouter-style `text+image->text` / `text->text` (Official shelf).
 * BYO must not invent this from Host TokenPlus/SiliconFlow books — those are
 * price feeds, not every agent's provider capability map. Bare `"text"` and
 * missing values are unknown.
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
