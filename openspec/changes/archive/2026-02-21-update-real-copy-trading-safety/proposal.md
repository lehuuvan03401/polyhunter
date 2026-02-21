# Change: Update Real Copy Trading Safety and Guardrails

## Why
Real-money copy trading currently lacks robust idempotency, pre-execution validation, and execution guardrails, which can lead to duplicate executions, avoidable failures, and increased operational risk when running with live funds.

## What Changes
- Add DB-level idempotency for copy trades keyed by original trade identifiers and config.
- Add pre-execution validation (balance/allowance/size clamping) before placing real trades.
- Add execution guardrails (global enable flag + per-wallet/per-day caps) for live trading.
- Persist execution metadata (e.g., used-bot-float flag) to make recovery deterministic.
- Add price/quote guard to ensure execution uses fresh market price and rejects stale data.

## Impact
- Affected specs: `copy-trading`, `copy-execution`
- Affected code: `scripts/copy-trading-worker.ts`, execution service, Prisma schema/migrations, API surfaces for copy-trading execution.
