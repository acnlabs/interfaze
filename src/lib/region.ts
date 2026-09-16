/** China-region Interfaze (interfaze.acnlabs.cn) vs Global (interfaze.io). */
export function isCnRegion(): boolean {
  return (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";
}

export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (isCnRegion() ? "https://interfaze.acnlabs.cn" : "https://interfaze.io")
  ).replace(/\/+$/, "");
}

export function getAgentPlanetBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_AGENTPLANET_URL ||
    (isCnRegion() ? "https://agentplanet.acnlabs.cn" : "https://agentplanet.org")
  ).replace(/\/+$/, "");
}

/** ComicLaw Studio origin for the Interfaze face-chat window. CN omitted (Auth0). */
export function getComicLawStudioUrl(): string {
  if (isCnRegion()) return "";
  const raw = (process.env.NEXT_PUBLIC_COMICLAW_STUDIO_URL || "").trim();
  if (raw) return raw.replace(/\/+$/, "");
  const app = (process.env.NEXT_PUBLIC_APP_ORIGIN || "").toLowerCase();
  if (app.includes("localhost") || app.includes("127.0.0.1")) {
    return "http://127.0.0.1:3000";
  }
  return "https://studio.comiclaw.acnlabs.org";
}

/** Embody origin for the Interfaze body-room window. CN omitted (Auth0). */
export function getEmbodyUrl(): string {
  if (isCnRegion()) return "";
  const raw = (process.env.NEXT_PUBLIC_EMBODY_URL || "").trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "https://embody-web.vercel.app";
}
