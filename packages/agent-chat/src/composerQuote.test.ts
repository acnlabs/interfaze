import { describe, expect, it } from "vitest";
import {
  hasDeclaredProviderModels,
  pickOfficialShelfSelection,
  uniqueBookCatalogPair,
} from "./composerQuote";

describe("uniqueBookCatalogPair", () => {
  const book = [
    { id: "deepseek/deepseek-v4-flash", in: 0.091, out: 0.182, source: "openrouter" },
    { id: "deepseek/deepseek-v4-pro", in: 0.2088, out: 0.4176, source: "openrouter" },
    { id: "~deepseek/deepseek-v4-flash-latest", in: 0.0422, out: 0.1763, source: "openrouter" },
    {
      id: "deepseek/deepseek-v4-flash:batch",
      in: 0.05,
      out: 0.15,
      source: "openrouter",
    },
  ];

  it("matches BYO vendor ids to the book by tail", () => {
    const hit = uniqueBookCatalogPair(
      "tencenttokenplan/deepseek/deepseek-v4-flash",
      book,
    );
    expect(hit?.id).toBe("deepseek/deepseek-v4-flash");
    expect(hit?.in).toBe(0.091);
  });

  it("does not price dated OEM ids absent from the book", () => {
    expect(
      uniqueBookCatalogPair("tencenttokenplan/deepseek-v4-flash-202605", book),
    ).toBeNull();
  });

  it("ignores ~ and :batch aliases when counting hits", () => {
    expect(uniqueBookCatalogPair("deepseek-v4-flash", book)?.id).toBe(
      "deepseek/deepseek-v4-flash",
    );
  });
});

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

  it("ignores prefixed leftovers not on the shelf (any BYO vendor)", () => {
    expect(
      pickOfficialShelfSelection({
        menuIds: menu,
        stored: "tencenttokenplan/kimi-k2.5",
        officialDefault: "deepseek/deepseek-chat",
      }),
    ).toBe("deepseek/deepseek-chat");
    expect(
      pickOfficialShelfSelection({
        menuIds: menu,
        stored: "siliconflow/Qwen/Qwen2.5-7B-Instruct",
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
