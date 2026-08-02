import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));
// Workspace root (parent of sibling repos: interfaze/, packages/, backend/, …)
const workspaceRoot = path.resolve(siteRoot, "..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@acnlabs/agent-chat"],
  // Resolve shared package from workspace while Interfaze remains its own git repo.
  turbopack: {
    root: workspaceRoot,
    resolveAlias: {
      "@acnlabs/agent-chat": "./packages/agent-chat/src/index.ts",
    },
  },
  reactStrictMode: false,
};

export default nextConfig;
