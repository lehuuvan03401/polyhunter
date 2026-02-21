# Change: Add Managed Wealth MVP (Simulated)

## Why
Non-professional users currently need to configure copy-trading parameters manually, which creates onboarding friction and limits conversion. We need a productized managed-wealth layer that packages strategy, term, risk, and settlement into simple subscriptions.

## What Changes
- Add a new capability `managed-wealth` for simulated managed products.
- Introduce managed products with strategy profiles (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`) and term buckets (1/3/7/15/30/60/90/180/365 days).
- Add isolated subscription accounts per user (no pooled funds).
- Add maturity settlement with profit-sharing and high-water-mark charging.
- Add conservative-only principal/minimum-yield protection backed by reserve fund ledger.
- Add transparency-by-default disclosure with optional delayed detail policy.
- Add operational controls to pause guaranteed subscriptions when reserve coverage is insufficient.

## Impact
- Affected specs: `managed-wealth` (new), `copy-trading` (integration reuse, no normative behavior change in this proposal).
- Affected code:
  - `web/prisma/schema.prisma`
  - `web/app/api/*` (new managed wealth routes)
  - `web/components/*` and `web/app/[locale]/*` (new pages)
  - `web/scripts/*` (NAV + settlement scheduler)
