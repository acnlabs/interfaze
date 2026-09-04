/** Official v0 is one non-stream completion; thinking SKUs hang or return empty.
 *  Keep in lockstep with backend official_v0_supports_model and ACN CLI. */
const O_SERIES = /(^|\/)o[134](?:$|[-/:])/;

/** CN-billed OpenRouter keys reject these prefixes. Match Host official_shelf_allows. */
const CN_KEY_BLOCKED_PREFIXES = ["openai/", "anthropic/", "google/gemini"] as const;

export function officialV0SupportsModel(modelId: string | null | undefined): boolean {
  const id = (modelId || "").trim().toLowerCase();
  if (!id) return true;
  if (id.includes("-think") || id.includes(":thinking") || id.includes("reasoning")) {
    return false;
  }
  if (id.includes("deepseek-r1")) return false;
  return !O_SERIES.test(id);
}

/** Settings Official shelf: this Host key can complete this id. */
export function officialShelfAllows(
  modelId: string | null | undefined,
  keyGeo: string | null | undefined,
): boolean {
  const id = (modelId || "").trim().toLowerCase();
  if (!id || !officialV0SupportsModel(id)) return false;
  if ((keyGeo || "").trim().toLowerCase() !== "cn") return true;
  return !CN_KEY_BLOCKED_PREFIXES.some((prefix) => id.startsWith(prefix));
}
