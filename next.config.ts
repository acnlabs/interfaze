import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

function embedFrameAncestors(): string {
  const extras = (
    process.env.NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS ||
    process.env.INTERFAZE_EMBED_ALLOWED_ORIGINS ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isProd = process.env.NODE_ENV === "production";
  const locals = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3010",
    "http://localhost:3010",
  ];
  const origins = extras.length > 0 ? extras : isProd ? [] : locals;
  return `frame-ancestors ${["'self'", ...new Set(origins)].join(" ")}`;
}

const nextConfig: NextConfig = {
  // Docker CN / standalone: set NEXT_OUTPUT_MODE=standalone at build time.
  ...(process.env.NEXT_OUTPUT_MODE === "standalone" ? { output: "standalone" as const } : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@acnlabs/agent-chat"],
  // Self-contained: vendored package lives at packages/agent-chat (works on Vercel).
  turbopack: {
    root: siteRoot,
    resolveAlias: {
      "@acnlabs/agent-chat": "./packages/agent-chat/src/index.ts",
    },
  },
  reactStrictMode: false,
  // PayPal SDK checkout opens a popup; default COOP same-origin yields about:blank.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        source: "/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: embedFrameAncestors(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
