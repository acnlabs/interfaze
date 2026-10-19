export type ComputerNameRow = {
  computer_id: string;
  is_default: boolean;
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

/** Opening another computer is a flat 100 of the spendable unit, same rate as the wallet. */
export function computerOpenCost(locale: "en" | "zh"): { hint: string; short: string } {
  const cn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";
  if (locale === "zh" && cn) {
    return {
      hint: "新对话进默认电脑。再开一台要 100 星币，也不会自动接新对话。100 星币 = 1 美元。",
      short: "星币不够，没有新开电脑。",
    };
  }
  if (locale === "zh") {
    return {
      hint: "新对话进默认电脑。再开一台要 100 Credit，也不会自动接新对话。100 Credit = 1 美元。",
      short: "Credit 不够，没有新开电脑。",
    };
  }
  return {
    hint: "New chats use the default computer. Another computer costs 100 Credits and does not take new chats on its own. 100 Credits = 1 USD.",
    short: "Not enough Credits. No computer was opened.",
  };
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
