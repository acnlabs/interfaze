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
