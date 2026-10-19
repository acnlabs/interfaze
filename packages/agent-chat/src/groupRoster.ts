export type RosterParticipant = {
  participant_type?: string | null;
  participant_id: string;
  is_active?: boolean | null;
  name?: string | null;
};

export type RosterRow = {
  id: string;
  name: string;
  kind: "agent" | "person";
};

function personName(name: string | null | undefined, selfName: string): string {
  const named = (name || "").trim();
  return named || selfName;
}

/** Agents stay mentionable. People in the same group still appear on the roster. */
export function groupRoster(
  participants: RosterParticipant[],
  agentLabels: Record<string, string>,
  selfName: string,
): RosterRow[] {
  const viewer: RosterRow[] = selfName.trim()
    ? [{ id: "self", name: selfName.trim(), kind: "person" }]
    : [];
  const active = participants.filter((row) => row.is_active !== false && row.participant_id);
  if (active.length === 0) {
    const agents = Object.entries(agentLabels).map(([id, name]) => ({
      id,
      name: name.trim() || id,
      kind: "agent" as const,
    }));
    return [...viewer, ...agents];
  }
  const people: RosterRow[] = [];
  const agents: RosterRow[] = [];
  for (const row of active) {
    const type = (row.participant_type || "").trim().toLowerCase();
    if (type === "agent") {
      const labeled = (agentLabels[row.participant_id] || "").trim();
      agents.push({
        id: row.participant_id,
        name: labeled || personName(row.name, row.participant_id),
        kind: "agent",
      });
      continue;
    }
    people.push({
      id: row.participant_id,
      name: personName(row.name, selfName),
      kind: "person",
    });
  }
  return [...(people.length > 0 ? people : viewer), ...agents];
}
