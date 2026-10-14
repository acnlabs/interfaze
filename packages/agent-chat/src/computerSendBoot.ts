/** Sending starts the chat computer only when this bubble copies a file onto an idle cloud machine. */

export type ChatComputerPlace = {
  place?: string;
  status?: string | null;
  computer_id?: string | null;
  resume_credits_per_hour?: number | null;
  screen_credits_per_hour?: number | null;
};

export type ListedComputer = {
  computer_id?: string | null;
  is_default?: boolean;
  status?: string | null;
  resume_credits_per_hour?: number | null;
};

/** A send copies onto the desk only when this bubble cites a mailbox file. */
export function sendNeedsDesk(text: string): boolean {
  return /(^|\s)mbx:[^\s]+/.test(text);
}

export function sendAsksBeforeBoot(
  place: ChatComputerPlace,
  openScreenIds: string[],
  needsDesk = false,
): boolean {
  if (!needsDesk) return false;
  if (place.place !== "cloud") return false;
  if (place.status !== "idle") return false;
  const id = place.computer_id;
  if (id && openScreenIds.includes(id)) return false;
  return true;
}

export type ScreenChargeHint = {
  status?: string | null;
  resumeCreditsPerHour?: number | null;
  screenCreditsPerHour?: number | null;
};

/** Ask when opening the screen would start the meter or raise the hourly rate. */
export function screenAsksBeforeCharge(hint: ScreenChargeHint): boolean {
  if (hint.status !== "running") return true;
  const resume = hint.resumeCreditsPerHour;
  const screen = hint.screenCreditsPerHour;
  if (resume == null || screen == null) return true;
  return screen > resume;
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
