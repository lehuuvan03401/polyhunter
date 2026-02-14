# Verification: add-hybrid-signal-ingestion

## Automated checks (completed)

| Check | Command | Result |
|---|---|---|
| Prisma schema format | `cd frontend && npx prisma format` | PASS |
| Prisma migration check | `cd frontend && DATABASE_URL=... npx prisma migrate dev --name add_signal_cursor` | PASS (`Already in sync`) |
| TypeScript compile | `cd frontend && npx tsc --noEmit` | FAIL (unrelated): `app/api/agents/route.ts` imports default `lib/prisma` |
| OpenSpec validation | `openspec validate add-hybrid-signal-ingestion --strict --no-interactive` | PASS |
| POLLING_ONLY startup smoke | `cd frontend && TRADING_PRIVATE_KEY=... DATABASE_URL=... COPY_TRADING_SIGNAL_MODE=POLLING_ONLY DRY_RUN=true SUPERVISOR_SELFTEST=true SUPERVISOR_SELFTEST_EXIT=true npx tsx scripts/copy-trading-supervisor.ts` | PASS (mode picked up; process exits cleanly) |

## Manual verification plan (Phase 2)

### 2.1 POLLING_ONLY captures and executes
1. Apply migration:
   - `cd frontend && npx prisma migrate dev --name add_signal_cursor`
2. Start supervisor in polling-only mode:
   - `COPY_TRADING_SIGNAL_MODE=POLLING_ONLY npx tsx scripts/copy-trading-supervisor.ts`
3. Trigger a monitored trader trade (real/dry-run environment).
4. Expect:
   - Log shows `POLLING_ONLY mode: WS/chain/mempool listeners disabled.`
   - Poll logs show `POLL DETECTED`
   - A single copy execution record is written.

> Note: if logs show `Failed to read/persist signal cursor`, run migration first and restart.

### 2.2 HYBRID no duplicate execution
1. Start supervisor in hybrid mode:
   - `COPY_TRADING_SIGNAL_MODE=HYBRID npx tsx scripts/copy-trading-supervisor.ts`
2. Use a trader with both WS and polling visibility.
3. Expect:
   - Same trade may appear from both sources, but execution happens once.
   - Dedup metric `hits` increases, duplicate orders are not created.

### 2.3 WS outage fallback
1. Keep `COPY_TRADING_SIGNAL_MODE=HYBRID`.
2. Break WS connectivity (network block / WS endpoint failure).
3. Expect:
   - Log shows `WS unhealthy ... Polling remains active`.
   - Polling continues to detect and execute trades.

### 2.4 Restart cursor resume
1. Run supervisor and process at least one polled trade.
2. Stop process and restart with same DB.
3. Expect:
   - No full-history replay storm.
   - Cursor resumes from recent watermark with bounded replay only.
