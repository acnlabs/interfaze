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

const IMAGE_FILE_NAME = /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i;

const OWNER_FILE_NAME =
  /\.(png|jpe?g|gif|webp|pdf|txt|wav|mp3|ogg|m4a|mp4|webm)$/i;

const OWNER_FILE_MIME = new Set([
  "application/pdf",
  "text/plain",
  "audio/wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "video/webm",
]);

/** Person uploads the composer may send. Known text-only models still receive the file. */
export function ownerFileTypeAllowed(
  file: { type?: string | null; name?: string | null } | null | undefined,
): boolean {
  if (!file) return false;
  const mime = (file.type || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (OWNER_FILE_MIME.has(mime)) return true;
  return OWNER_FILE_NAME.test((file.name || "").trim());
}

export function fileLooksLikeImage(
  file: { type?: string | null; name?: string | null } | null | undefined,
): boolean {
  if (!file) return false;
  if (mimeLooksLikeImage(file.type)) return true;
  return IMAGE_FILE_NAME.test((file.name || "").trim());
}

export function filesLookLikeImages(
  files: Iterable<{ type?: string | null; name?: string | null }> | null | undefined,
): boolean {
  if (!files) return false;
  for (const file of files) {
    if (fileLooksLikeImage(file)) return true;
  }
  return false;
}

/** dragover hides the file list; "Files" is the signal that a drop can be accepted. */
export function dataTransferTypesIncludeFiles(
  types: Iterable<string> | null | undefined,
): boolean {
  if (!types) return false;
  for (const type of types) {
    if (type === "Files" || type === "application/x-moz-file") return true;
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
