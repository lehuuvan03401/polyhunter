<!--
    Implementation tasks for Fix Affiliate System Issues
-->

- [x] Fix Tier Auto-Upgrade <!-- id: 0 -->
    - [x] Add `checkAndUpgradeTier(referrerId)` method to `AffiliateEngine` <!-- id: 1 -->
    - [x] Call tier check at end of `distributeCommissions()` for all rewarded members <!-- id: 2 -->
    - [x] Update verification script to test tier upgrade flow <!-- id: 3 -->
- [x] Fix Volume Tracking <!-- id: 4 -->
    - [x] Update `Referral.lifetimeVolume` and `last30DaysVolume` in `distributeCommissions()` <!-- id: 5 -->
    - [x] Update `Referrer.totalVolume` for the direct sponsor <!-- id: 6 -->
    - [x] Cascade `teamVolume` update to all ancestors via Closure Table <!-- id: 7 -->
    - [x] Add `ReferralVolume` daily aggregation record creation <!-- id: 8 -->
- [x] Secure Payout Endpoint <!-- id: 9 -->
    - [x] Add signature verification to `POST /api/affiliate/payouts` <!-- id: 10 -->
    - [x] Update frontend to request wallet signature before payout <!-- id: 11 -->
    - [x] Return clear error messages for invalid signatures <!-- id: 12 -->
- [x] Enhance CommissionLog <!-- id: 13 -->
    - [x] Pass `generation` parameter to `recordCommission()` method <!-- id: 14 -->
    - [x] Add `sourceUserId` (trader address) to commission logs <!-- id: 15 -->
- [x] Team API Pagination <!-- id: 16 -->
    - [x] Add `limit` and `offset` query parameters to `/api/affiliate/team` <!-- id: 17 -->
    - [x] Return total count in response for pagination UI <!-- id: 18 -->
- [/] Verification <!-- id: 19 -->
    - [x] Update `verify-affiliate-logic.ts` to test tier upgrades <!-- id: 20 -->
    - [x] Add volume tracking assertions to verification script <!-- id: 21 -->
    - [ ] Manual test: payout signature flow in browser <!-- id: 22 -->

