import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOCALS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3010",
  "http://localhost:3010",
];

let cached: { at: number; value: string } | null = null;
const TTL_MS = 60_000;

async function frameAncestors(): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const gateway = (process.env.NEXT_PUBLIC_GATEWAY_URL || "").replace(/\/+$/, "");
  const envList = (
    process.env.NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS ||
    process.env.INTERFAZE_EMBED_ALLOWED_ORIGINS ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let fromGateway: string[] = [];
  if (gateway) {
    try {
      const res = await fetch(`${gateway}/api/chat/embed/config`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const body = (await res.json()) as { allowed_origins?: unknown };
        if (Array.isArray(body.allowed_origins)) {
          fromGateway = body.allowed_origins.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          );
        }
      }
    } catch {
      /* Gateway down: env + self */
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const origins = ["'self'", ...fromGateway, ...envList, ...(isProd ? [] : LOCALS)];
  const value = `frame-ancestors ${[...new Set(origins)].join(" ")}`;
  cached = { at: now, value };
  return value;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/embed") {
    return NextResponse.next();
  }
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", await frameAncestors());
  return response;
}

export const config = { matcher: ["/embed", "/embed/:path*"] };
