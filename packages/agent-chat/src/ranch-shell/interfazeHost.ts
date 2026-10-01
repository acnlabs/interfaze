/** Exact Interfaze hosts (avoid `startsWith("interfaze.")` typosquat). */
export function isInterfazeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "interfaze.io" ||
    h.endsWith(".interfaze.io") ||
    h === "interfaze.acnlabs.cn" ||
    h.endsWith(".interfaze.acnlabs.cn") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

/** Same-origin on Interfaze hosts; otherwise the injected public origin. */
export function resolveInterfazeOrigin(interfazeBaseUrl?: string): string {
  const fromProp = (interfazeBaseUrl || "").replace(/\/$/, "");
  if (typeof window !== "undefined" && isInterfazeHostname(window.location.hostname)) {
    return window.location.origin;
  }
  return fromProp || "https://interfaze.io";
}

/** CN WeChat Native QR works in-panel; Global PayPal must be top-level. */
export function prefersInPanelCheckout(urlOrOrigin: string): boolean {
  try {
    const h = new URL(urlOrOrigin, "https://interfaze.io").hostname.toLowerCase();
    return h === "interfaze.acnlabs.cn" || h.endsWith(".interfaze.acnlabs.cn");
  } catch {
    return false;
  }
}

/** True when the given origin/URL is the CN site (interfaze.acnlabs.cn). */
export function isCnInterfazeOrigin(urlOrOrigin: string): boolean {
  return prefersInPanelCheckout(urlOrOrigin);
}

export function buildWalletCheckoutUrl(opts?: {
  interfazeBaseUrl?: string;
  embed?: boolean;
  returnTo?: string;
}): string {
  const base = resolveInterfazeOrigin(opts?.interfazeBaseUrl);
  const u = new URL(`${base}/wallet`);
  if (opts?.embed) {
    u.searchParams.set("embed", "1");
    if (typeof window !== "undefined") {
      u.searchParams.set("parent_origin", window.location.origin);
    }
  }
  const returnTo = opts?.returnTo || "/?account=wallet";
  u.searchParams.set("return_to", returnTo);
  return u.toString();
}
