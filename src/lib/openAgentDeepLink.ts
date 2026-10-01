const STORAGE_KEY = "interfaze:open-agent";

/** Same-origin path + query for Auth0 / WeChat returnTo. */
export function currentReturnTo(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}` || "/";
}

export function peekOpenAgentId(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("agent")?.trim();
  if (fromQuery) return fromQuery;
  try {
    return (sessionStorage.getItem(STORAGE_KEY) || "").trim() || null;
  } catch {
    return null;
  }
}

/** Survive login hops that drop `?agent=` (Auth0 appState / CN return_to). */
export function persistOpenAgentId(agentId: string): void {
  const id = agentId.trim();
  if (!id || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}

export function takeOpenAgentId(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("agent")?.trim();
  let fromStore: string | null = null;
  try {
    fromStore = (sessionStorage.getItem(STORAGE_KEY) || "").trim() || null;
  } catch {
    fromStore = null;
  }
  const id = fromQuery || fromStore;
  if (!id) return null;
  if (fromQuery) persistOpenAgentId(fromQuery);
  return id;
}

export function clearOpenAgentId(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
