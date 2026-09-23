/** Conversation-orchestrator metadata on agent writeback (D12 / D9). */

export type OrchestrationCallee = {
  agent_id: string;
  hop_id?: string;
  status?: string;
  name?: string;
};

export type OrchestrationProposeTask = {
  title: string;
  description?: string;
  reward?: string;
  deadline_hours?: number;
};

export type OrchestrationProposeGroup = {
  agent_ids: string[];
  title?: string;
  summary?: string;
  existing_chat_id?: string;
};

const MAX_CALLEES = 8;
const MAX_SUMMARY = 4000;
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

function isDroppedAgentId(id: string): boolean {
  const lowered = id.toLowerCase();
  return (
    !id ||
    id.length > 128 ||
    lowered.startsWith("local:") ||
    lowered.startsWith("sys:")
  );
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
    if (isDroppedAgentId(id)) continue;
    const lowered = id.toLowerCase();
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

export function proposeGroupFromMetadata(meta: unknown): OrchestrationProposeGroup | null {
  const rec = asRecord(meta);
  const orch = rec ? asRecord(rec.orchestration) : null;
  const raw = orch ? asRecord(orch.propose_group) : null;
  if (!raw) return null;
  const idsRaw = raw.agent_ids ?? raw.participants;
  const agent_ids: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(idsRaw)) {
    for (const item of idsRaw) {
      if (agent_ids.length >= MAX_CALLEES) break;
      const row = asRecord(item);
      const rawId = row ? row.agent_id ?? row.id ?? row.to : item;
      if (typeof rawId !== "string") continue;
      const id = bareAgentId(rawId);
      if (isDroppedAgentId(id)) continue;
      const lowered = id.toLowerCase();
      if (seen.has(lowered)) continue;
      seen.add(lowered);
      agent_ids.push(id);
    }
  }
  const title =
    typeof raw.title === "string" ? raw.title.trim().slice(0, 200) : "";
  const summary =
    typeof raw.summary === "string" ? raw.summary.trim().slice(0, MAX_SUMMARY) : "";
  const existingRaw =
    typeof raw.existing_chat_id === "string"
      ? raw.existing_chat_id.trim().slice(0, 64)
      : "";
  const existing =
    existingRaw && !isDroppedAgentId(existingRaw) ? existingRaw : "";
  if (!agent_ids.length && !existing) return null;
  const out: OrchestrationProposeGroup = { agent_ids };
  if (title) out.title = title;
  if (summary) out.summary = summary;
  if (existing) out.existing_chat_id = existing;
  return out;
}

export function proposeTaskFromMetadata(meta: unknown): OrchestrationProposeTask | null {
  const rec = asRecord(meta);
  const orch = rec ? asRecord(rec.orchestration) : null;
  const raw = orch ? asRecord(orch.propose_task) : null;
  if (!raw || typeof raw.title !== "string") return null;
  const title = raw.title.trim().slice(0, 200);
  if (!title) return null;
  const out: OrchestrationProposeTask = { title };
  let rewardOk = false;
  if (typeof raw.description === "string") {
    const description = raw.description.trim().slice(0, 2000);
    if (description) out.description = description;
  }
  const rewardRaw =
    typeof raw.reward === "number" && Number.isFinite(raw.reward)
      ? String(raw.reward)
      : raw.reward;
  if (typeof rewardRaw === "string") {
    const reward = rewardRaw.trim().slice(0, 32);
    const amount = Number(reward);
    if (reward && Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000) {
      out.reward = reward;
      rewardOk = true;
    }
  }
  if (!rewardOk) return null;
  if (typeof raw.deadline_hours === "number" && Number.isFinite(raw.deadline_hours)) {
    const hours = Math.trunc(raw.deadline_hours);
    if (hours >= 1 && hours <= 2160) out.deadline_hours = hours;
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
