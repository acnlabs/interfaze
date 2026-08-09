/** postMessage type for embed checkout → Host Plan & Usage panel. */
export const PLAN_ACTIVATED_MSG = "interfaze:plan-activated";

const PARENT_ORIGIN_KEY = "interfaze_embed_parent_origin";

function envParentOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_EMBED_PARENT_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function tryOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Origins allowed to receive interfaze:plan-activated (never "*"). */
export function allowedEmbedParentOrigins(): Set<string> {
  const allow = new Set<string>([
    "https://agentplanet.acnlabs.cn",
    "https://agentplanet.org",
    "https://interfaze.acnlabs.cn",
    "https://interfaze.io",
  ]);
  for (const raw of envParentOrigins()) {
    const o = tryOrigin(raw);
    if (o) allow.add(o);
  }
  if (typeof window !== "undefined") {
    allow.add(window.location.origin);
  }
  return allow;
}

/** Persist allowlisted parent_origin so OAuth/PayPal redirects keep it. */
export function stashEmbedParentOrigin(raw: string | null | undefined): void {
  const origin = tryOrigin(raw);
  if (!origin || typeof sessionStorage === "undefined") return;
  const allow = allowedEmbedParentOrigins();
  if (!allow.has(origin) && !isLocalDevOrigin(origin)) return;
  try {
    sessionStorage.setItem(PARENT_ORIGIN_KEY, origin);
  } catch {
    /* ignore */
  }
}

export function readStashedParentOrigin(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return tryOrigin(sessionStorage.getItem(PARENT_ORIGIN_KEY));
  } catch {
    return null;
  }
}

/** Query param → session stash → referrer. Always re-stash when query present. */
export function resolveEmbedParentOrigin(
  parentOriginParam: string | null | undefined,
): string | null {
  if (parentOriginParam) stashEmbedParentOrigin(parentOriginParam);
  return (
    tryOrigin(parentOriginParam) ||
    readStashedParentOrigin() ||
    (typeof document !== "undefined" ? tryOrigin(document.referrer) : null)
  );
}

/**
 * Resolve postMessage targetOrigin from embed `parent_origin` query and/or referrer.
 * Returns null when no allowlisted parent is known (caller must not use "*").
 */
export function resolvePostMessageTarget(
  parentOriginParam: string | null | undefined,
): string | null {
  const allow = allowedEmbedParentOrigins();
  const candidates = [
    resolveEmbedParentOrigin(parentOriginParam),
    typeof document !== "undefined" ? tryOrigin(document.referrer) : null,
  ].filter((o): o is string => Boolean(o));

  for (const c of candidates) {
    if (allow.has(c) || isLocalDevOrigin(c)) return c;
  }
  return null;
}

/** Ensure `parent_origin` is on a relative path (e.g. `/subscribe?plan=pro`). */
export function withEmbedParentOrigin(
  relativePath: string,
  parentOrigin: string | null | undefined,
): string {
  const origin = tryOrigin(parentOrigin) || readStashedParentOrigin();
  if (!origin) return relativePath;
  try {
    const u = new URL(relativePath, "https://placeholder.local");
    u.searchParams.set("parent_origin", origin);
    return `${u.pathname}${u.search}`;
  } catch {
    return relativePath;
  }
}

export function notifyPlanActivated(
  planCode: string,
  paidUntil?: string | null,
  parentOriginParam?: string | null,
): void {
  if (typeof window === "undefined" || window.parent === window) return;
  const target = resolvePostMessageTarget(parentOriginParam);
  if (!target) return;
  try {
    window.parent.postMessage(
      {
        type: PLAN_ACTIVATED_MSG,
        plan_code: planCode,
        paid_until: paidUntil ?? null,
      },
      target,
    );
  } catch {
    /* ignore */
  }
}
