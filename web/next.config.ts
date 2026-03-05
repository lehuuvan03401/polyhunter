import "./env";
import dns from "node:dns";

// Fix Node 18+ fetch IPv6 ECONNRESET issues for certain APIs (e.g. data-api.polymarket.com)
dns.setDefaultResultOrder("ipv4first");
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin(
  './i18n/request.ts'
);

const nextConfig: NextConfig = {
  // Disable Turbopack for build - it has issues with workspace packages
  // Turbopack still works for `next dev` via --turbo flag
  experimental: {
    // Allow workspace-linked packages (file:..)
    externalDir: true,
  },
  transpilePackages: ['@catalyst-team/poly-sdk'],
};

export default withNextIntl(nextConfig);
