/** Sending starts the chat computer only when this chat is on an idle cloud machine. */

export function sendAsksBeforeBoot(
  place: {
    place?: string;
    status?: string | null;
    computer_id?: string | null;
  },
  openScreenIds: string[],
): boolean {
  if (place.place !== "cloud") return false;
  if (place.status !== "idle") return false;
  const id = place.computer_id;
  if (id && openScreenIds.includes(id)) return false;
  return true;
}
