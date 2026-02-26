# Change: Harden Horus participation and partner policy closure

## Why
The previous implementation batch delivered the core participation and global partner capabilities, but several external-policy-critical items are still partial: immutable 100-seat cap, mandatory managed authorization boundaries, production activation gates, same-level bonus default, automated month-end elimination/refund SLA enforcement, and explicit FREE-mode execution boundaries.

## What Changes
- Lock global partner seat cap to an immutable hard limit of 100.
- Introduce month-end elimination automation and refund SLA watchdog to reduce manual operational risk.
- Enforce managed-mode activation and custody authorization as production-default hard gates.
- Enforce same-level bonus settlement as production-default behavior aligned with external policy.
- Make FREE-mode execution boundary explicit and enforceable at API level.
- Clarify and enforce fee-policy scope to avoid conflicting fee paths against the fixed 20% realized-profit policy.

## Impact
- Affected specs:
  - `global-partner-program` (modified)
  - `participation-program` (modified)
  - `affiliate-system` (modified)
  - `fee-logic` (modified)
- Affected code (expected):
  - `web/app/api/partners/config/route.ts`
  - `web/app/api/partners/cycle/eliminate/route.ts`
  - `web/app/api/partners/refunds/route.ts`
  - `web/scripts/workers/*` (new scheduler/watchdog)
  - `web/app/api/managed-subscriptions/route.ts`
  - `web/app/api/participation/custody-auth/route.ts`
  - `web/lib/services/affiliate-engine.ts`
  - `web/app/api/proxy/*` (fee-scope and FREE-mode boundary checks)
  - operational docs and test suites
