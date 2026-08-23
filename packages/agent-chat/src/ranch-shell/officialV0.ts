/** Official v0 is one non-stream completion; thinking SKUs hang or return empty.
 *  Keep in lockstep with backend official_v0_supports_model and ACN CLI. */
const O_SERIES = /(^|\/)o[134](?:$|[-/:])/;

export function officialV0SupportsModel(modelId: string | null | undefined): boolean {
  const id = (modelId || "").trim().toLowerCase();
  if (!id) return true;
  if (id.includes("-think") || id.includes(":thinking") || id.includes("reasoning")) {
    return false;
  }
  if (id.includes("deepseek-r1")) return false;
  return !O_SERIES.test(id);
}
