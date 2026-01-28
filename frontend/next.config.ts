import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Next resolves env files relative to the frontend app root.
    root: path.join(__dirname),
  },
  experimental: {
    // Allow workspace-linked packages (file:..)
    externalDir: true,
  },
  transpilePackages: ['@catalyst-team/poly-sdk'],
};

export default nextConfig;
