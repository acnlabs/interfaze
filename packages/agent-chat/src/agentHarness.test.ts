import { describe, expect, it } from "vitest";
import {
  harnessLabel,
  knownHarnessMark,
  parseAgentHarness,
  readReportedHarness,
} from "./agentHarness";

describe("parseAgentHarness", () => {
  it("keeps a name, version, and https logo", () => {
    expect(
      parseAgentHarness({
        name: " OpenClaw ",
        version: " 2026.3.1 ",
        logo_url: "https://cdn.example/mark.png",
      }),
    ).toEqual({
      name: "OpenClaw",
      version: "2026.3.1",
      logo_url: "https://cdn.example/mark.png",
    });
  });

  it("drops a non-https logo and a blank report", () => {
    expect(
      parseAgentHarness({ name: "Dots", logo_url: "http://cdn.example/m.png" }),
    ).toEqual({
      name: "Dots",
      version: null,
      logo_url: null,
    });
    expect(parseAgentHarness({ name: "  " })).toBeNull();
    expect(parseAgentHarness(null)).toBeNull();
  });

  it("formats the info line and still reads the previous key", () => {
    expect(harnessLabel({ name: "Hermes", version: "0.9" })).toBe("Hermes · 0.9");
    expect(harnessLabel({ name: "Muse" })).toBe("Muse");
    expect(readReportedHarness({ harness: { name: "OpenClaw" } }).value).toEqual({
      name: "OpenClaw",
    });
    expect(readReportedHarness({ framework: { name: "Codex" } }).value).toEqual({
      name: "Codex",
    });
  });

  it("picks a hosted mark only for names we have a logo for", () => {
    expect(knownHarnessMark("OpenClaw")).toBe("openclaw");
    expect(knownHarnessMark("open claw")).toBe("openclaw");
    expect(knownHarnessMark("Hermes")).toBe("hermes");
    expect(knownHarnessMark("Claude Code")).toBe("claude-code");
    expect(knownHarnessMark("claude-code")).toBe("claude-code");
    expect(knownHarnessMark("Codex")).toBe("codex");
    expect(knownHarnessMark("OpenAI Codex")).toBe("codex");
    expect(knownHarnessMark("Claude")).toBeNull();
    expect(knownHarnessMark("Dots")).toBeNull();
  });
});
