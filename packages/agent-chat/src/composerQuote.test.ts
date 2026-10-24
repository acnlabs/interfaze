import { describe, expect, it } from "vitest";
import {
  hasDeclaredProviderModels,
  pickOfficialShelfSelection,
} from "./composerQuote";

describe("hasDeclaredProviderModels", () => {
  it("is false for missing or empty providers", () => {
    expect(hasDeclaredProviderModels(null)).toBe(false);
    expect(hasDeclaredProviderModels([])).toBe(false);
    expect(
      hasDeclaredProviderModels([{ id: "tencenttokenplan", models: [] }]),
    ).toBe(false);
  });

  it("is true when any provider lists a model", () => {
    expect(
      hasDeclaredProviderModels([
        {
          id: "tencenttokenplan",
          models: ["tencenttokenplan/deepseek-v4-flash-202605"],
          current: true,
        },
      ]),
    ).toBe(true);
  });
});

describe("pickOfficialShelfSelection", () => {
  const menu = [
    "deepseek/deepseek-chat",
    "moonshotai/kimi-k2.5",
    "aion-labs/aion-2.0",
  ];

  it("ignores BYO leftover preferred_model and uses official default", () => {
    expect(
      pickOfficialShelfSelection({
        menuIds: menu,
        stored: "tencenttokenplan/kimi-k2.5",
        officialDefault: "deepseek/deepseek-chat",
      }),
    ).toBe("deepseek/deepseek-chat");
  });

  it("keeps a prior official-shelf session pin", () => {
    expect(
      pickOfficialShelfSelection({
        menuIds: menu,
        stored: "moonshotai/kimi-k2.5",
        officialDefault: "deepseek/deepseek-chat",
      }),
    ).toBe("moonshotai/kimi-k2.5");
  });

  it("falls back to the first shelf id when default is off the menu", () => {
    expect(
      pickOfficialShelfSelection({
        menuIds: menu,
        stored: "tencenttokenplan/kimi-k2.5",
        officialDefault: "openai/gpt-4o-mini",
      }),
    ).toBe("deepseek/deepseek-chat");
  });
});
