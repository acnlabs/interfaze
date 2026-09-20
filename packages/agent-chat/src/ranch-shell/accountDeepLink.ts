/** Account surfaces that belong in `/?account=`. */

export type AccountDeepLinkPanel = "plan" | "wallet" | "manage" | "profile" | "keys";

const PANELS = new Set<string>(["plan", "wallet", "manage", "profile", "keys"]);

export function readAccountPanelFromUrl(
  search: string = typeof window === "undefined" ? "" : window.location.search,
): AccountDeepLinkPanel | null {
  const raw = new URLSearchParams(search).get("account")?.toLowerCase() || "";
  const mapped = raw === "quota" || raw === "credit" ? "keys" : raw;
  return PANELS.has(mapped) ? (mapped as AccountDeepLinkPanel) : null;
}

export function accountPanelHref(panel: AccountDeepLinkPanel): string {
  if (typeof window === "undefined") return `/?account=${panel}`;
  const u = new URL(window.location.href);
  u.searchParams.set("account", panel);
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
}

export function writeAccountPanelToUrl(
  panel: AccountDeepLinkPanel | null,
  mode: "push" | "replace",
): void {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  const current = readAccountPanelFromUrl(u.search);
  if (panel) {
    if (current === panel) return;
    u.searchParams.set("account", panel);
  } else {
    if (!current) return;
    u.searchParams.delete("account");
  }
  const q = u.searchParams.toString();
  const next = `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}
