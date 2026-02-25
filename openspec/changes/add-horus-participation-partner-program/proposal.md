# Change: Add Horus participation mechanism and global partner program

## Why
The market team has published a formal external policy for participation, custody packages, referral incentives, and global partner seats. The current codebase already contains partial capabilities (managed subscriptions, membership pricing, one-time referral extension), but the rules are not fully aligned or unified across copy-trading, managed-wealth, affiliate, and operations workflows.

## What Changes
- Add a new `participation-program` capability that defines:
  - dual funding channels (exchange + TP wallet)
  - activation gate (registration + qualified deposit)
  - position modes (`FREE` / `MANAGED`) and minimum thresholds
  - strategy presets (Conservative/Moderate/Aggressive)
  - service period options (1-day trial, 7/30/90/180/360 days)
  - managed package return matrix by principal bands (A/B/C)
  - MCN-equivalent settlement for all USDT-denominated rules
- Modify `fee-logic` to enforce a unified realized-profit fee model:
  - no-profit => no fee
  - fixed 20% on realized profit for both `FREE` and `MANAGED`
- Extend `affiliate-system` with growth mechanics required by the policy:
  - one-time direct referral +1 day subscription extension
  - net-deposit accounting (`deposit - withdraw`)
  - daily V1-V9 level evaluation and team dividend rates
  - same-level bonus rates (1st gen 4%, 2nd gen 1%)
  - double-zone promotion progress tracking (one-push-two)
- Add a new `global-partner-program` capability:
  - hard cap of 100 seats
  - monthly bottom-10 elimination
  - refund workflow within 7 days for eliminated seats
  - dynamic re-fill price support after elimination
  - partner privilege mapping (V5-equivalent benefits + exclusive console access)
- Define security boundaries for custodial and non-custodial modes.

## Impact
- Affected specs:
  - `participation-program` (new)
  - `fee-logic` (modified)
  - `affiliate-system` (extended)
  - `global-partner-program` (new)
- Affected code (expected):
  - `web/prisma/schema.prisma` + migrations
  - `web/app/api/managed-membership/*`
  - `web/app/api/managed-subscriptions/*`
  - `web/app/api/affiliate/*`
  - `web/lib/services/affiliate-engine.ts`
  - `web/scripts/workers/managed-wealth-worker.ts`
  - new partner-seat APIs, worker jobs, and admin pages
  - managed-wealth/affiliate/partner front-end pages and i18n content
