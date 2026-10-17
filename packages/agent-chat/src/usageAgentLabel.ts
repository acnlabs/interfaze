/** Plan-usage "by agent" label. A real name, otherwise the first 8 characters of the id. */

export function usageAgentKey(agentId?: string | null): string {
  return (agentId || "").replace(/^acn:/i, "").trim().toLowerCase();
}

function looksLikeId(label: string, agentId: string): boolean {
  const text = label.trim().toLowerCase();
  const raw = agentId.trim().toLowerCase();
  const bare = usageAgentKey(agentId);
  return !text || text === raw || text === bare || text === `acn:${bare}`;
}

/** First real name wins. Pass owned and directory rows before chat titles. */
export function indexUsageAgentNames(
  rows: Array<{ agentId?: string | null; name?: string | null }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = usageAgentKey(row.agentId);
    const label = (row.name || "").trim();
    if (!key || key === "unknown" || !label || out[key]) continue;
    if (looksLikeId(label, row.agentId || "")) continue;
    out[key] = label;
  }
  return out;
}

export function usageAgentLabel(
  agentId: string,
  name: string | null | undefined,
  unknownLabel: string,
): { text: string; showId: boolean } {
  const id = (agentId || "").trim();
  const key = usageAgentKey(id);
  if (!key || key === "unknown") return { text: unknownLabel, showId: false };
  const label = (name || "").trim();
  if (label && !looksLikeId(label, id)) return { text: label, showId: false };
  return { text: key.length > 8 ? key.slice(0, 8) : key, showId: true };
}

/** Integer percent at 1% and above. A positive share under 1% stays "under 1%". */
export function usageShareLabel(share: number, usedPct: string, underOne: string): string {
  const pct = Number.isFinite(share) && share > 0 ? share * 100 : 0;
  if (pct > 0 && pct < 1) return underOne;
  return usedPct.split("{n}").join(String(Math.round(pct)));
}
