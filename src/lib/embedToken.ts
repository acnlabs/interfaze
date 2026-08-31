/** Resolve the embed token without putting it in Referer / access logs. */

export function tokenFromLocation(search: string, hash: string): string {
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const fromHash = (hashParams.get("token") || "").trim();
  if (fromHash) return fromHash;
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return (query.get("token") || "").trim();
}

/** Drop leftover `?token=` after the client has read it. */
export function stripQueryTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("token")) return;
  url.searchParams.delete("token");
  const search = url.searchParams.toString();
  window.history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
}

export function originOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}
