# Verification: Optimize DB Design (P1 Locking)

## Goal
Ensure multiple worker instances do not process the same CopyTrade rows concurrently.

## Steps
1. Start two workers against the same DB with a short lock TTL for visibility:
   - `COPY_TRADING_LOCK_TTL_MS=60000 npx tsx scripts/copy-trading-worker.ts`
2. Seed a few `SETTLEMENT_PENDING` and `FAILED` trades (or use existing data).
3. Observe logs:
   - Each trade should be processed by only one worker in a given interval.
   - No duplicate retries or settlements should appear.
4. Optional DB check:
   - Query `CopyTrade` for `lockedBy` values during processing; confirm one owner per trade.

## Pass Criteria
- No duplicate recovery or retry execution across workers.
- Locked rows show a single `lockedBy` owner until released or TTL expires.
