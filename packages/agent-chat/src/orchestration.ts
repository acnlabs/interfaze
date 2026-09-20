/** Conversation-orchestrator callees on agent writeback metadata (D12). */

export type OrchestrationCallee = {
  agent_id: string;
  hop_id?: string;
  status?: string;
  name?: string;
};

const MAX_CALLEES = 8;
const STATUS = new Set(["accepted", "sent", "completed", "failed"]);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function bareAgentId(raw: string): string {
  const t = raw.trim();
  return t.toLowerCase().startsWith("acn:") ? t.slice(4).trim() : t;
}

export function calleesFromMetadata(meta: unknown): OrchestrationCallee[] {
  const rec = asRecord(meta);
  const orch = rec ? asRecord(rec.orchestration) : null;
  if (!orch || !Array.isArray(orch.callees)) return [];
  const out: OrchestrationCallee[] = [];
  const seen = new Set<string>();
  for (const item of orch.callees) {
    if (out.length >= MAX_CALLEES) break;
    const row = asRecord(item);
    if (!row) continue;
    const rawId = row.agent_id ?? row.to;
    if (typeof rawId !== "string") continue;
    const id = bareAgentId(rawId);
    if (!id || id.length > 128) continue;
    const lowered = id.toLowerCase();
    if (lowered.startsWith("local:") || lowered.startsWith("sys:")) continue;
    if (seen.has(lowered)) continue;
    seen.add(lowered);
    const callee: OrchestrationCallee = { agent_id: id };
    if (typeof row.hop_id === "string") {
      const hop = row.hop_id.trim();
      if (hop.startsWith("hop:invoke:") && hop.length > 11 && hop.length <= 200) {
        callee.hop_id = hop;
      }
    }
    if (typeof row.status === "string") {
      const st = row.status.trim().toLowerCase();
      if (STATUS.has(st)) callee.status = st;
    }
    if (typeof row.name === "string") {
      const name = row.name.trim().slice(0, 200);
      if (name) callee.name = name;
    }
    out.push(callee);
  }
  return out;
}

export function calleeLabel(
  c: OrchestrationCallee,
  names?: Record<string, string>,
): string {
  if (c.name) return c.name;
  const key = c.agent_id.toLowerCase();
  if (names) {
    for (const [id, n] of Object.entries(names)) {
      if (bareAgentId(id).toLowerCase() === key && n.trim()) return n.trim();
    }
  }
  return c.agent_id.length > 8 ? c.agent_id.slice(0, 8) : c.agent_id;
}

export function orchLine(
  c: OrchestrationCallee,
  t: {
    orchCalled: (name: string) => string;
    orchAsked: (name: string) => string;
    orchFailed: (name: string) => string;
  },
  names?: Record<string, string>,
): string {
  const label = calleeLabel(c, names);
  if (c.status === "failed") return t.orchFailed(label);
  if (c.status === "accepted" || c.status === "sent") return t.orchAsked(label);
  return t.orchCalled(label);
}
