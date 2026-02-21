# Change: Fix Affiliate System Critical Issues

## Why
During code review of the recently implemented affiliate/MLM system, several critical issues were discovered that prevent the system from operating correctly. The tier upgrade mechanism is not implemented, volume tracking is broken, and the payout endpoint lacks security verification.

## What Changes
1. **Tier Upgrade Logic**: Implement automatic tier promotion based on team size and volume thresholds in `AffiliateEngine`.
2. **Volume Tracking**: Update `totalVolume`, `teamVolume`, and `Referral.lifetimeVolume` fields when trades occur.
3. **Payout Security**: Add wallet signature verification to the payout API to prevent unauthorized withdrawals.
4. **CommissionLog Enhancement**: Populate the `generation` field for better analytics.
5. **Team API Pagination**: Add `limit/offset` support to prevent performance issues with large teams.
6. **ReferralVolume Aggregation**: Implement daily volume tracking as designed in schema.

## Impact
- Affected specs: `affiliate-system` (new capability)
- Affected code:
  - `web/lib/services/affiliate-engine.ts`
  - `web/app/api/affiliate/payouts/route.ts`
  - `web/app/api/affiliate/team/route.ts`
  - `web/scripts/copy-trading-supervisor.ts`
