# Change: Add batched reimbursement ledger for bot float

## Why
Async settlement reduces latency but still requires per-trade reimbursement transfers, which creates high on-chain TX volume and throughput bottlenecks at scale. A batched ledger allows netting reimbursements while bounding bot float exposure.

## What Changes
- Add a reimbursement ledger to accumulate bot float reimbursements per proxy.
- Flush reimbursements in batches based on amount/age thresholds.
- Enforce an outstanding-float cap to prevent runaway exposure.
- Emit metrics and runbook guidance for ledger backlog and flush health.

## Impact
- Affected specs: `copy-execution`
- Affected code: `src/services/copy-trading-execution-service.ts`, `scripts/copy-trading-worker.ts`, Prisma schema/migrations, runbook/docs.
