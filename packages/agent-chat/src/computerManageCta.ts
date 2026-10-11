/** Empty list creates the default. A list that already has a computer opens an extra. */
export function computerManageCta(count: number): "create" | "extra" {
  return count > 0 ? "extra" : "create";
}

/** Opening an extra is free, but it does not take new chats. Ask first. */
export function extraAsksBeforeCreate(count: number): boolean {
  return computerManageCta(count) === "extra";
}

/** China pause is a disk charge. Overseas pause is free and does not ask. */
export function pauseAsksBeforeCharge(pausedCreditsPerHour: number | undefined): boolean {
  return (pausedCreditsPerHour ?? 0) > 0;
}
