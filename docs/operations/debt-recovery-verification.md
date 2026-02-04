# Debt Recovery Verification (Worker)

This guide verifies the worker-side debt recovery loop introduced for copy trading execution.

## Preconditions
- `DATABASE_URL` points to the copy trading database.
- Worker is configured with a real execution key (or test key) and can connect to RPC.
- Proxy for the target wallet holds sufficient USDC for repayment.

## Steps
1) Identify the active worker address.
   - Start the worker and note `Execution Worker: <address>` in logs.

2) Insert a PENDING debt record for the active worker.
   - Example SQL (Postgres):

```sql
INSERT INTO "DebtRecord" ("id", "proxyAddress", "botAddress", "amount", "currency", "status", "errorLog", "createdAt")
VALUES (
  gen_random_uuid(),
  '<PROXY_ADDRESS>',
  '<WORKER_ADDRESS>',
  5.0,
  'USDC',
  'PENDING',
  NULL,
  NOW()
);
```

3) Ensure the proxy has sufficient USDC for the repayment amount.

4) Wait for recovery loop.
   - The worker runs debt recovery every 5 minutes and once on startup.
   - Logs should show:
     - `[Debt] Found <n> pending debts...`
     - `[Debt] ✅ Recovered $<amount> ...`

5) Verify the record is marked repaid.

```sql
SELECT "status", "repaidAt", "errorLog"
FROM "DebtRecord"
WHERE "botAddress" = '<WORKER_ADDRESS>'
ORDER BY "createdAt" DESC
LIMIT 5;
```

Expected: `status = 'REPAID'` and a non-null `repaidAt`.

## Negative Case (Insufficient Proxy Funds)
1) Insert a debt larger than proxy USDC balance.
2) Wait for recovery loop.
3) Verify record remains `PENDING` and `errorLog` may be updated after recovery attempts.

## Notes
- The worker only recovers debts for its own `botAddress`.
- Only `USDC` debts are handled by the current recovery loop.
