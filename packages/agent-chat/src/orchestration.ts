/** Conversation-orchestrator callees on agent writeback metadata (D12). */

export type OrchestrationCallee = {
  agent_id: string;
  hop_id?: string;
  status?: string;
  name?: string;
};

const MAX_CALLEES = 8;
const MAX_DECIDE = 8;
const STATUS = new Set(["accepted", "sent", "completed", "failed"]);
const ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

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

export type DecideOption = { id: string; label: string };

export type DecideShadow = {
  status?: string;
  choice?: string;
  mode?: string;
  gate?: { ask_human?: boolean };
};

export type DecideApplied = { option_id: string; by?: string };

export type MessageDecide = {
  options: DecideOption[];
  shadow?: DecideShadow | null;
  applied?: DecideApplied | null;
};

export function decideFromMetadata(meta: unknown): MessageDecide | null {
  const rec = asRecord(meta);
  const orch = rec ? asRecord(rec.orchestration) : null;
  const decide = orch ? asRecord(orch.decide) : null;
  if (!decide || !Array.isArray(decide.options)) return null;
  const options: DecideOption[] = [];
  const seen = new Set<string>();
  for (const item of decide.options) {
    if (options.length >= MAX_DECIDE) break;
    const row = asRecord(item);
    if (!row || typeof row.id !== "string" || typeof row.label !== "string") continue;
    const id = row.id.trim();
    const label = row.label.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!id || !label || !ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    options.push({ id, label });
  }
  if (options.length < 2) return null;
  const out: MessageDecide = { options };
  const shadow = asRecord(decide.shadow);
  if (shadow) {
    const parsed: DecideShadow = {};
    if (typeof shadow.status === "string") {
      const v = shadow.status.trim().slice(0, 40);
      if (v) parsed.status = v;
    }
    if (typeof shadow.choice === "string") {
      const v = shadow.choice.trim().slice(0, 80);
      if (v) parsed.choice = v;
    }
    if (typeof shadow.mode === "string") {
      const v = shadow.mode.trim().slice(0, 40);
      if (v) parsed.mode = v;
    }
    const gate = asRecord(shadow.gate);
    if (gate && typeof gate.ask_human === "boolean") {
      parsed.gate = { ask_human: gate.ask_human };
    }
    if (parsed.status || parsed.choice || parsed.mode || parsed.gate) {
      out.shadow = parsed;
    }
  }
  const applied = asRecord(decide.applied);
  if (applied && typeof applied.option_id === "string") {
    const optionId = applied.option_id.trim();
    if (ID_RE.test(optionId)) {
      const by = typeof applied.by === "string" ? applied.by.trim() : "";
      out.applied = { option_id: optionId, by: by || undefined };
    }
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
