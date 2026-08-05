export const AUTH0_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "dev-ypufda63738rkary.us.auth0.com";

export const AUTH0_AUDIENCE = (
  process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "https://api.agentplanet.org"
).replace(/\/+$/, "");

export const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "";

/** Scopes for IdP login + API access token (+ refresh). */
export const AUTH0_SCOPE = "openid profile email offline_access";

export const isAuth0Configured = () => !!AUTH0_CLIENT_ID;

/** Drop SPA SDK cache so the next login mints a fresh API access token. */
export function clearAuth0ClientCache() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("@@auth0spajs@@")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * True when Auth0 says the session cannot be recovered silently
 * (must interactive login). Network / iframe / timeout failures are NOT this —
 * those must not clear the SPA cache or force a login loop (esp. Chrome 3P cookies).
 */
export function isSessionDeadAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    error?: string;
    code?: string;
    message?: string;
    error_description?: string;
  };
  const code = String(e.error || e.code || "").toLowerCase();
  const blob = `${e.message || ""} ${e.error_description || ""}`.toLowerCase();
  const dead = [
    "login_required",
    "consent_required",
    "interaction_required",
    "invalid_grant",
    "missing_refresh_token",
    "invalid_token",
  ];
  if (dead.includes(code)) return true;
  return dead.some((d) => blob.includes(d));
}
