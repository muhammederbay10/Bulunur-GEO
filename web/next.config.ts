import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["amount-dallying-approve.ngrok-free.dev"],
  cacheComponents: true,
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
