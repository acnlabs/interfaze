/** Chat Gateway HTTP base (AgentPlanet backend or BFF). */
export function getGatewayBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GATEWAY_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    // Local default when env omitted
    return "http://127.0.0.1:8000";
  }
  return "http://127.0.0.1:8000";
}
