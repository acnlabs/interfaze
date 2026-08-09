/**
 * CN Web auth — WeChat OAuth via BFF.
 * Session JWT: RS256, sub=wechat|<openid> (same as AgentPlanet CN Host).
 */
import { getBffBaseUrl } from "@/lib/bff";

const TOKEN_KEY = "cn_session_token";
const USER_KEY = "cn_session_user";
const JWT_EXP_SKEW_SECONDS = 30;

export interface CnSessionUser {
  openid: string;
  nickname: string;
  avatar?: string;
}

export interface CnJwtPayload {
  sub?: string;
  exp?: number;
  nickname?: string;
  name?: string;
  avatar_url?: string;
  avatar?: string;
  [key: string]: unknown;
}

export function decodeCnJwtPayload(token: string): CnJwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as CnJwtPayload;
  } catch {
    return null;
  }
}

export function isCnJwtExpired(
  token: string | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!token) return true;
  const payload = decodeCnJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp <= nowSec + JWT_EXP_SKEW_SECONDS;
}

export function getCnSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isCnJwtExpired(token)) {
    clearCnSession();
    return null;
  }
  return token;
}

export function getCnSessionUser(): CnSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CnSessionUser) : null;
  } catch {
    return null;
  }
}

export function setCnSession(token: string, user: CnSessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearCnSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isCnWebLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CN_WEB_LOGIN_ENABLED === "true";
}

export function defaultCnDisplayLabel(principalId: string): string {
  let tail = principalId;
  if (principalId.includes("|")) {
    tail = principalId.slice(principalId.indexOf("|") + 1);
  } else if (principalId.startsWith("wechat:")) {
    tail = principalId.slice("wechat:".length);
  }
  const suffix = tail.length >= 6 ? tail.slice(-6) : tail;
  return `用户·${suffix}`;
}

function isLegacyOpenidNickname(nickname: string, openid: string): boolean {
  const n = nickname.trim();
  return n === openid.slice(0, 8) || n === openid;
}

export function cnDisplayName(user: CnSessionUser): string {
  const id = `wechat|${user.openid}`;
  const nick = (user.nickname || "").trim();
  const generic = new Set(["微信用户", "WeChat User", ""]);
  if (nick && !generic.has(nick) && !isLegacyOpenidNickname(nick, user.openid)) {
    return nick;
  }
  return defaultCnDisplayLabel(id);
}

/** Redirect to BFF WeChat OAuth. Returns false if Web login is disabled. */
export function startWeChatLogin(returnTo?: string): boolean {
  if (!isCnWebLoginEnabled()) {
    const hint =
      process.env.NEXT_PUBLIC_CN_WEB_LOGIN_HINT ||
      "Web 登录即将开放，请使用微信小程序体验完整功能。";
    if (typeof window !== "undefined") window.alert(hint);
    return false;
  }
  const target = returnTo ?? window.location.pathname + window.location.search;
  const url = new URL("/api/auth/wechat/web/start", getBffBaseUrl());
  url.searchParams.set(
    "return_to",
    `${window.location.origin}/auth/wechat/callback?return_to=${encodeURIComponent(target)}`,
  );
  const href = url.toString();
  const inIframe =
    typeof window !== "undefined" &&
    window.parent != null &&
    window.parent !== window;
  if (inIframe) {
    // Never navigate Host top window — OAuth in a same-origin tab; iframe
    // picks up session via localStorage `storage` events.
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blocked: navigate the iframe only (may be framed-out by WeChat).
      window.location.href = href;
    }
    return true;
  }
  window.location.href = href;
  return true;
}

/**
 * BFF Web OAuth redirects with `#token=` (fragment — not logged / not in Referer).
 * Ignore `?token=` so crafted query links cannot seed a session without BFF verify.
 */
export function parseTokenFromCallback(_search: string, hash: string): string | null {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return hashParams.get("token");
}

/** Confirm a callback JWT with BFF (signature + expiry) before persisting session. */
export async function verifyCnSessionWithBff(
  token: string,
): Promise<CnSessionUser | null> {
  if (!token || isCnJwtExpired(token)) return null;
  const res = await fetch(`${getBffBaseUrl()}/api/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const payload = decodeCnJwtPayload(token);
  if (!payload) return null;
  const sub = String(payload.sub ?? "");
  const openid = sub.replace(/^wechat\|/, "").trim();
  if (!openid) return null;
  const nickname = String(payload.nickname ?? payload.name ?? "").trim();
  const avatar =
    String(payload.avatar_url ?? payload.avatar ?? "").trim() || undefined;
  return { openid, nickname, avatar };
}

export async function exchangeWeChatCode(
  code: string,
): Promise<{ access_token: string; user: CnSessionUser }> {
  const res = await fetch(
    `${getBffBaseUrl()}/api/auth/wechat/web/callback?code=${encodeURIComponent(code)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`微信登录失败（${res.status}）`);
  return res.json() as Promise<{ access_token: string; user: CnSessionUser }>;
}
