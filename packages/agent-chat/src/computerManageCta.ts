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

/** Status line. A billed pause prints the hourly disk price. */
export function computerStatusLine(
  row: { status: string; has_disk: boolean; paused_credits_per_hour?: number },
  labels: {
    idle: string;
    paused: string;
    running: string;
    files: string;
    emptyDisk: string;
    pausedAt: string;
  },
): string {
  const status =
    row.status === "idle"
      ? labels.idle
      : row.status === "paused"
        ? labels.paused
        : row.status === "running"
          ? labels.running
          : row.status;
  const disk = row.has_disk ? labels.files : labels.emptyDisk;
  const rate = row.paused_credits_per_hour ?? 0;
  if (row.status === "paused" && rate > 0) {
    return `${labels.pausedAt.replace("{rate}", String(rate))} · ${disk}`;
  }
  return `${status} · ${disk}`;
}
