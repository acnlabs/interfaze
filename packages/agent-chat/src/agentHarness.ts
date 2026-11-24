/** Self-reported agent harness from heartbeat ``metadata.harness``. Not verified. */
export type AgentHarness = {
  name: string;
  version?: string | null;
  logo_url?: string | null;
};

export function parseAgentHarness(raw: unknown): AgentHarness | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 80) : "";
  if (!name) return null;
  const version = typeof row.version === "string" ? row.version.trim().slice(0, 64) : "";
  const logo = typeof row.logo_url === "string" ? row.logo_url.trim() : "";
  const logoOk =
    logo.length > 0 &&
    logo.length <= 2048 &&
    logo.toLowerCase().startsWith("https://") &&
    !/\s/.test(logo);
  return {
    name,
    version: version || null,
    logo_url: logoOk ? logo : null,
  };
}

export function harnessLabel(harness: AgentHarness): string {
  const version = (harness.version || "").trim();
  return version ? `${harness.name} · ${version}` : harness.name;
}

/** `harness` wins. `framework` is the previous wire key. */
export function readReportedHarness(raw: object): { present: boolean; value: unknown } {
  if ("harness" in raw) return { present: true, value: (raw as { harness?: unknown }).harness };
  if ("framework" in raw) {
    return { present: true, value: (raw as { framework?: unknown }).framework };
  }
  return { present: false, value: undefined };
}
