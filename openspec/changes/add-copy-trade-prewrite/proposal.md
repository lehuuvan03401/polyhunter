# Change: Add Prewrite Execution Ledger for Real Copy Trading

## Why
Real copy-trading currently risks orphan executions because fast-track execution can occur before the CopyTrade record is safely persisted. If the database insert fails or a duplicate is detected after execution starts, we can end up with trades that are hard to audit, reconcile, or retry safely.

## What Changes
- Persist a CopyTrade record (PENDING) before any execution or on-chain transfer is initiated.
- Enforce DB-level idempotency by letting the insert fail fast on duplicates and skipping execution.
- Ensure execution updates reuse the prewritten CopyTrade ID for deterministic status transitions and recovery.
- Add stale-PENDING recovery handling to prevent stuck prewrite records from blocking future trades.

## Impact
- Affected specs: `copy-trading`
- Affected code: `scripts/copy-trading-worker.ts`, copy-trade retry/recovery logic
