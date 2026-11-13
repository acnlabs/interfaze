export type ComputerNameRow = {
  computer_id: string;
  is_default: boolean;
  status?: string | null;
  resume_credits_per_hour?: number;
  screen_credits_per_hour?: number;
};

export function computerName(
  isDefault: boolean,
  extraIndex: number,
  locale: "en" | "zh",
): string {
  if (isDefault) return locale === "zh" ? "电脑" : "Computer";
  const number = extraIndex + 2;
  return locale === "zh" ? `电脑 ${number}` : `Computer ${number}`;
}

export function extraIndex(rows: ComputerNameRow[], computerId: string): number {
  let index = 0;
  for (const row of rows) {
    if (row.is_default) continue;
    if (row.computer_id === computerId) return index;
    index += 1;
  }
  return 0;
}

export function chatComputerLabel(
  place: "agent" | "cloud",
  isDefault: boolean | null,
  nthExtra: number,
  locale: "en" | "zh",
): string {
  if (place === "agent" || isDefault == null) {
    return locale === "zh" ? "Agent 的机器" : "Agent machine";
  }
  return computerName(isDefault, nthExtra, locale);
}

export type ComputerRunStatus = "running" | "paused" | "idle";

/** Cloud computers report one of these. Anything else has no status mark. */
export function computerRunStatus(status: string | null | undefined): ComputerRunStatus | null {
  if (status === "running" || status === "paused" || status === "idle") return status;
  return null;
}

const STATUS_WORD: Record<"en" | "zh", Record<ComputerRunStatus, string>> = {
  en: { running: "On", paused: "Paused", idle: "Idle" },
  zh: { running: "开着", paused: "暂停", idle: "空闲" },
};

export function computerStatusWord(
  status: string | null | undefined,
  locale: "en" | "zh",
): string | null {
  const mark = computerRunStatus(status);
  return mark ? STATUS_WORD[locale][mark] : null;
}
