import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
};

export default nextConfig;
