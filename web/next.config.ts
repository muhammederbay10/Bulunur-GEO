import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["amount-dallying-approve.ngrok-free.dev"],
  cacheComponents: true,
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
