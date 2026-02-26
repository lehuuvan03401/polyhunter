# Change: Close managed-wealth execution and settlement loop

## Why
Managed wealth currently provides productized onboarding and lifecycle APIs, but the end-to-end business loop is still partially open in runtime behavior: trader allocation is mostly static, position accounting is wallet-scoped instead of subscription-scoped, liquidation still has simulated paths, and profit-fee distribution is not uniformly triggered across all settlement entrypoints.

To align runtime behavior with product commitments (managed custody flow, strategy consistency, and deterministic marketing distribution), we need a hard-closed loop across allocation, execution scope, liquidation, settlement, and commission distribution.

## What Changes
- Add a formal `managed-wealth` capability spec that defines:
  - score-based weighted-random trader allocation,
  - subscription-scoped execution accounting,
  - managed principal reservation linkage,
  - unified settlement pipeline,
  - real liquidation requirement and observability.
- Modify `fee-logic` to require profit-fee distribution parity across all managed settlement paths (manual withdraw, worker auto-settlement, and admin batch settlement).
- Modify `participation-program` to require explicit principal reservation linkage between managed subscriptions and managed funding scope.

## Impact
- Affected specs:
  - `managed-wealth` (new capability)
  - `fee-logic` (modified)
  - `participation-program` (modified)
- Affected code (expected):
  - `web/scripts/workers/managed-wealth-worker.ts`
  - `web/app/api/managed-settlement/run/route.ts`
  - `web/app/api/managed-subscriptions/[id]/withdraw/route.ts`
  - `web/app/api/managed-subscriptions/route.ts`
  - `web/lib/services/affiliate-engine.ts`
  - `web/lib/services/position-service.ts`
  - `web/prisma/schema.prisma` + new migrations
  - managed wealth UI pages/components for allocation and subscription constraints

