# Change: Add Lock-Claim Verification Runbook

## Why
CopyTrade locking (`lockedAt/lockedBy`) is now implemented to prevent multi-worker double-processing, but there is no standardized operational verification. A lightweight runbook and seed/cleanup tools ensure operators can validate the locking behavior safely and repeatably.

## What Changes
- Add an operations runbook documenting lock-claim verification steps.
- Add a small verification script to seed test `CopyTrade` rows (`SETTLEMENT_PENDING` / `FAILED`) and a cleanup step to remove or reset them.
- Document expected log/DB signals during multi-worker runs.

## Impact
- **Affected specs:** copy-trading
- **Affected code:** `docs/operations/`, `scripts/verify/`
- **Risk:** Low (docs + optional verification tooling only)
