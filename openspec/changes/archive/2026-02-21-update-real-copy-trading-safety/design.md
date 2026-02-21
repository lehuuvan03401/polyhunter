## Context
Real-time copy trading runs against live Polymarket data and may execute with real funds. The current worker can duplicate execution or proceed without sufficient balances/allowances. Recovery logic depends on metadata that is not always persisted.

## Goals / Non-Goals
- Goals:
  - Prevent duplicate execution across WS reconnects or multiple workers.
  - Fail fast when funds or approvals are insufficient.
  - Provide guardrails for real-money execution.
  - Make settlement recovery deterministic.
- Non-Goals:
  - Redesign the copy-trading strategy logic.
  - Add new UI surfaces beyond existing configuration fields.

## Decisions
- Decision: Use a deterministic idempotency key derived from (configId + originalTxHash) when available, with a fallback derived from (configId + tokenId + side + size + price + timestamp bucket).
- Decision: Add DB constraints to enforce idempotency.
- Decision: Gate real execution with an explicit `ENABLE_REAL_TRADING` flag and caps (global + per-wallet per day).
- Decision: Add pre-execution balance/allowance checks and clamp sell sizes to actual balance.
- Decision: Persist execution metadata (e.g., `usedBotFloat`) on the CopyTrade record to make recovery robust.

## Risks / Trade-offs
- Stricter validation may reduce trade throughput if RPCs are slow. Mitigation: cache balances/allowances with short TTL and skip checks for simulated mode.
- Idempotency constraints may require migration and cleanup for existing duplicates. Mitigation: pre-migration scan and optional dedupe script.

## Migration Plan
1) Add new columns/indexes via Prisma migration.
2) Deploy worker updates with idempotency and guardrails enabled but in dry-run mode.
3) Enable `ENABLE_REAL_TRADING=true` only after validation.

## Open Questions
- Should caps be stored per config or global env-only?
- What TTL is acceptable for price guard in high-volatility markets?
