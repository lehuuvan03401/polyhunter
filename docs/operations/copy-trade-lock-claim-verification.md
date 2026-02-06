# CopyTrade Lock-Claim Verification

## Purpose
Verify that `lockedAt/lockedBy` prevents multiple workers from processing the same CopyTrade rows.

## Prerequisites
- `DATABASE_URL` set to the target DB.
- At least two worker processes can be started.

## Steps
1. Seed test rows (SETTLEMENT_PENDING + FAILED):
   ```bash
   DATABASE_URL=... npx tsx scripts/verify/seed-copytrade-locks.ts seed
   ```
2. Option A: Start two workers (dry-run is OK):
   ```bash
   DATABASE_URL=... COPY_TRADING_LOCK_TTL_MS=60000 COPY_TRADING_DRY_RUN=true npx tsx scripts/copy-trading-worker.ts
   DATABASE_URL=... COPY_TRADING_LOCK_TTL_MS=60000 COPY_TRADING_DRY_RUN=true npx tsx scripts/copy-trading-worker.ts
   ```
3. Option B (if execution service is unavailable): Run two claim scripts in parallel:
   ```bash
   DATABASE_URL=... COPY_TRADING_LOCK_TTL_MS=60000 LOCK_HOLD_MS=8000 npx tsx scripts/verify/claim-copytrade-locks.ts
   DATABASE_URL=... COPY_TRADING_LOCK_TTL_MS=60000 LOCK_HOLD_MS=8000 npx tsx scripts/verify/claim-copytrade-locks.ts
   ```
4. Observe logs:
   - Each trade should be processed once per lock window.
5. Optional DB check (while workers are running):
   ```sql
   SELECT id, status, lockedBy, lockedAt FROM "CopyTrade" WHERE lockedBy IS NOT NULL;
   ```
6. Cleanup seeded rows:
   ```bash
   DATABASE_URL=... npx tsx scripts/verify/seed-copytrade-locks.ts cleanup
   ```

## Pass Criteria
- No duplicate processing of the same trade across workers.
- Locked rows show only one `lockedBy` value at a time.
