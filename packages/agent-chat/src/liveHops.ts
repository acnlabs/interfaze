/** Agent-to-agent hops for the dock graph. Messages supply a snapshot; hop events move a hop. */

import { calleesFromMetadata } from "./orchestration";

export type HopPhase = "in_flight" | "completed" | "failed";

export type LiveHop = {
  key: string;
  hopId: string | null;
  fromId: string;
  toId: string;
  phase: HopPhase;
  name: string | null;
};

export type HopUpdate = {
  hopId: string;
  fromId: string;
  toId: string;
  phase: HopPhase;
  name: string | null;
};

type HopMessage = {
  sender_type?: string | null;
  sender_id?: string | null;
  metadata?: unknown;
};

function bareAgentId(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.toLowerCase().startsWith("acn:") ? trimmed.slice(4).trim() : trimmed;
}

function hopKey(hopId: string | null, fromId: string, toId: string): string {
  if (hopId) return hopId.toLowerCase();
  return `${fromId.toLowerCase()}->${toId.toLowerCase()}`;
}

function phaseOfStatus(status: string | undefined): HopPhase {
  const value = (status || "").toLowerCase();
  if (value === "accepted" || value === "sent") return "in_flight";
  if (value === "failed") return "failed";
  return "completed";
}

function isTerminal(phase: HopPhase): boolean {
  return phase !== "in_flight";
}

function remember(map: Map<string, LiveHop>, next: LiveHop) {
  const prev = map.get(next.key);
  if (!prev) {
    map.set(next.key, next);
    return;
  }
  if (isTerminal(prev.phase) && !isTerminal(next.phase)) {
    if (!prev.name && next.name) map.set(next.key, { ...prev, name: next.name });
    return;
  }
  map.set(next.key, {
    ...next,
    hopId: next.hopId || prev.hopId,
    name: next.name || prev.name,
  });
}

/** Fold chat writebacks, then later hop events. A finished hop does not go back to in-flight. */
export function foldLiveHops(messages: HopMessage[], events: HopUpdate[]): LiveHop[] {
  const map = new Map<string, LiveHop>();
  for (const message of messages) {
    if ((message.sender_type || "").toLowerCase() !== "agent") continue;
    const fromId = bareAgentId(message.sender_id || "");
    if (!fromId) continue;
    for (const callee of calleesFromMetadata(message.metadata)) {
      const toId = bareAgentId(callee.agent_id);
      if (!toId || toId.toLowerCase() === fromId.toLowerCase()) continue;
      const hopId = callee.hop_id ?? null;
      remember(map, {
        key: hopKey(hopId, fromId, toId),
        hopId,
        fromId,
        toId,
        phase: phaseOfStatus(callee.status),
        name: callee.name ?? null,
      });
    }
  }
  for (const event of events) {
    const hop = eventToHop(event);
    if (!hop.fromId || !hop.toId || hop.fromId.toLowerCase() === hop.toId.toLowerCase()) continue;
    remember(map, hop);
  }
  return [...map.values()];
}

function eventToHop(event: HopUpdate): LiveHop {
  const fromId = bareAgentId(event.fromId);
  const toId = bareAgentId(event.toId);
  const hopId = event.hopId.trim();
  return {
    key: hopKey(hopId, fromId, toId),
    hopId,
    fromId,
    toId,
    phase: event.phase,
    name: event.name,
  };
}

const PHASES = new Set<HopPhase>(["in_flight", "completed", "failed"]);

/** Read one hop.updated payload. Null when the call is not tied to a hop id. */
export function parseHopUpdate(data: unknown): HopUpdate | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const hopId = typeof row.hop_id === "string" ? row.hop_id.trim() : "";
  const fromRaw = row.from_agent_id ?? row.from;
  const toRaw = row.to_agent_id ?? row.to;
  const phase = typeof row.phase === "string" ? row.phase.trim().toLowerCase() : "";
  if (!hopId.startsWith("hop:invoke:") || hopId.length <= 11 || hopId.length > 240) return null;
  if (typeof fromRaw !== "string" || typeof toRaw !== "string") return null;
  if (!PHASES.has(phase as HopPhase)) return null;
  const fromId = bareAgentId(fromRaw);
  const toId = bareAgentId(toRaw);
  if (!fromId || !toId || fromId.toLowerCase() === toId.toLowerCase()) return null;
  if (/^(system|local):/i.test(fromId) || /^(system|local):/i.test(toId)) return null;
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 200) : "";
  return { hopId, fromId, toId, phase: phase as HopPhase, name: name || null };
}
