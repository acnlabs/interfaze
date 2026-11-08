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

/** True only when modality is a known text-only input. Unknown stays open. */
export function imageInputBlocked(modality: string | null | undefined): boolean {
  return acceptsImageInput(modality) === false;
}

export function filesLookLikeImages(
  files: Iterable<{ type?: string | null }> | null | undefined,
): boolean {
  if (!files) return false;
  for (const file of files) {
    if (mimeLooksLikeImage(file?.type)) return true;
  }
  return false;
}

/**
 * Official / shelf-only: OpenRouter catalog modality.
 * BYO: agent-reported rows only.
 */
export function modalityForSelectedModel(args: {
  useCatalog: boolean;
  modelId: string;
  agentRows: Array<{ model_id: string; modality?: string | null }>;
  catalogRows: Array<{ id: string; modality?: string | null }>;
  sameShown: (id: string, wanted: string) => boolean;
  sameId: (id: string, wanted: string) => boolean;
}): string | null {
  const wanted = args.modelId.trim();
  if (!wanted) return null;
  if (args.useCatalog) {
    const row =
      args.catalogRows.find((item) => args.sameShown(item.id, wanted)) ??
      args.catalogRows.find((item) => args.sameId(item.id, wanted));
    return row?.modality ?? null;
  }
  const row =
    args.agentRows.find((item) => args.sameShown(item.model_id, wanted)) ??
    args.agentRows.find((item) => args.sameId(item.model_id, wanted));
  return row?.modality ?? null;
}
