# Change: Update copy-trading go-live hardening

## Why
The current copy-trading stack still has production blockers in security, consistency, and capacity control. Audit findings show unauthorized write risk, double-execution race windows, fail-open secret defaults, non-atomic guardrail counters, unbounded in-memory cache growth, and execution-state gaps that can leave trades stuck in `PENDING`.

Without closing these gaps, the system cannot meet strict commercial go-live requirements for correctness, safety, and operational predictability.

## What Changes
- Enforce fail-closed authentication for privileged copy-trading endpoints (including `detect` and `redeem-sim`) and production signature enforcement for wallet-scoped APIs.
- Remove insecure secret/key fallbacks (`CRON_SECRET`, all-zero `ENCRYPTION_KEY`) and require explicit startup validation.
- Introduce atomic pending-trade claim semantics in execute flows to prevent concurrent double execution.
- Harden detection idempotency to rely on stable source identity (`originalTxHash`) instead of timestamp/float heuristics.
- Fix orchestrator result classification and terminal-state handling so successful EOA executions are classified correctly and exception paths do not leave orphan `PENDING` trades.
- Enforce bounded cache/pagination/resource budgets to avoid memory and query amplification under load.
- Normalize supervisor/API environment contracts (chain id, dry-run, auth toggles) to eliminate drift and hidden misconfiguration.
- Require atomic counter semantics for guardrail accounting across concurrent workers/shards.

## Impact
- Affected specs: `copy-trading`, `copy-execution`, `storage`
- Affected code:
  - `web/app/api/copy-trading/*`
  - `web/lib/copy-trading/request-wallet.ts`
  - `web/lib/managed-wealth/request-wallet.ts`
  - `web/lib/encryption.ts`
  - `web/lib/server-cache.ts`
  - `web/scripts/workers/copy-trading-supervisor.ts`
  - `sdk/src/core/trade-orchestrator.ts`
  - `web/prisma/schema.prisma` and related migrations/tests
