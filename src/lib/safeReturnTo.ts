/** Same-origin relative path only — blocks open redirects. */
export function safeReturnTo(raw: string | null | undefined): string {
  const v = (raw || "").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/?account=plan";
  try {
    const u = new URL(v, "https://interfaze.local");
    if (u.origin !== "https://interfaze.local") return "/?account=plan";
    const path = `${u.pathname}${u.search}`;
    return path || "/?account=plan";
  } catch {
    return "/?account=plan";
  }
}

/** After plan checkout success → chat shell + Plan panel. */
export function planCheckoutReturnHref(returnTo: string): string {
  const dest = new URL(returnTo, "https://interfaze.local");
  if (!dest.searchParams.get("account")) dest.searchParams.set("account", "plan");
  dest.searchParams.set("checkout", "ok");
  return dest.pathname + dest.search;
}
