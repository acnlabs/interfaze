/** Sending starts the chat computer only when this chat is on an idle cloud machine. */

export type ChatComputerPlace = {
  place?: string;
  status?: string | null;
  computer_id?: string | null;
  resume_credits_per_hour?: number | null;
};

export type ListedComputer = {
  computer_id?: string | null;
  is_default?: boolean;
  status?: string | null;
  resume_credits_per_hour?: number | null;
};

export function sendAsksBeforeBoot(
  place: ChatComputerPlace,
  openScreenIds: string[],
): boolean {
  if (place.place !== "cloud") return false;
  if (place.status !== "idle") return false;
  const id = place.computer_id;
  if (id && openScreenIds.includes(id)) return false;
  return true;
}

/** New group chats land on the default computer, not an extra one. */
export function placeForDefaultComputer(computers: ListedComputer[]): ChatComputerPlace {
  const row = computers.find((item) => item.is_default) ?? computers[0];
  if (!row) {
    return {
      place: "cloud",
      status: "idle",
      computer_id: null,
      resume_credits_per_hour: null,
    };
  }
  return {
    place: "cloud",
    status: row.status ?? "idle",
    computer_id: row.computer_id ?? null,
    resume_credits_per_hour: row.resume_credits_per_hour ?? null,
  };
}
