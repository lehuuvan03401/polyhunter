import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/gamma/:path*',
        destination: 'https://gamma-api.polymarket.com/:path*',
      },
    ];
  },
  webpack: (config) => {
    const path = require('path');
    config.resolve.alias['@catalyst-team/poly-sdk'] = path.resolve(__dirname, '../src/index.ts');

    // Handle ESM imports with .js extension
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };

    // Also include external modules that the SDK source needs but aren't in dashboard deps
    // This might be needed if the previous tsconfig fix wasn't enough for bundling
    return config;
  },
};

export default nextConfig;
