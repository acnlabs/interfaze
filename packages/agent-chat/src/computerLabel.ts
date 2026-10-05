export type ComputerNameRow = {
  computer_id: string;
  is_default: boolean;
};

export function computerName(
  isDefault: boolean,
  extraIndex: number,
  locale: "en" | "zh",
): string {
  if (isDefault) return locale === "zh" ? "默认电脑" : "Default computer";
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
