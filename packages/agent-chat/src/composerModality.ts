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

/** A dropped item. Directories are walked; the folder itself is not a file. */
export type DroppedEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (ok: (file: File) => void, err?: () => void) => void;
  createReader?: () => {
    readEntries: (ok: (entries: DroppedEntry[]) => void, err?: () => void) => void;
  };
};

const DROP_WALK_MAX_FILES = 32;
const DROP_WALK_MAX_DEPTH = 8;

function fileFromDroppedEntry(entry: DroppedEntry): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

function readDroppedDirectory(entry: DroppedEntry): Promise<DroppedEntry[]> {
  const reader = entry.createReader?.();
  if (!reader) return Promise.resolve([]);
  return new Promise((resolve) => {
    const all: DroppedEntry[] = [];
    const read = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(all);
            return;
          }
          all.push(...batch);
          read();
        },
        () => resolve(all),
      );
    };
    read();
  });
}

/** Files inside a drop. A folder contributes the files under it, not the folder. */
export async function filesFromDroppedEntries(entries: readonly DroppedEntry[]): Promise<File[]> {
  const out: File[] = [];
  const walk = async (entry: DroppedEntry, depth: number) => {
    if (out.length >= DROP_WALK_MAX_FILES) return;
    if (entry.isFile) {
      if (depth > 0 && entry.name.startsWith(".")) return;
      const file = await fileFromDroppedEntry(entry);
      if (file) out.push(file);
      return;
    }
    if (!entry.isDirectory || depth >= DROP_WALK_MAX_DEPTH) return;
    for (const child of await readDroppedDirectory(entry)) {
      if (out.length >= DROP_WALK_MAX_FILES) return;
      await walk(child, depth + 1);
    }
  };
  for (const entry of entries) await walk(entry, 0);
  return out;
}

/** Use the file list for a plain drop. Walk when the drop contains a folder. */
export async function filesFromDataTransfer(data: {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<{ webkitGetAsEntry?: () => DroppedEntry | null }> | null;
}): Promise<{ files: File[]; expandedDirectory: boolean }> {
  const items = data.items ? Array.from(data.items) : [];
  const entries: DroppedEntry[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.() ?? null;
    if (entry) entries.push(entry);
  }
  if (entries.some((entry) => entry.isDirectory)) {
    return { files: await filesFromDroppedEntries(entries), expandedDirectory: true };
  }
  return { files: data.files ? Array.from(data.files) : [], expandedDirectory: false };
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
