# Design: Data Archiving

## 1. Schema Changes
We will create mirror tables for `CopyTrade` and `CommissionLog` with the suffix `Archive`.
These tables should have identical columns to the main tables, but foreign key constraints (like `configId`) might be optional or removed to prevent "cascade delete" issues—although keeping them is safer for data integrity if the parent config still exists.
**Decision**: Keep foreign keys. If a `CopyTradingConfig` is deleted, the cascade will delete archived trades too, which is generally acceptable behavior (user deleted = data gone).

### New Models
```prisma
model CopyTradeArchive {
  id             String            @id
  // ... all fields from CopyTrade ...
  archivedAt     DateTime          @default(now())

  @@index([configId])
  @@index([executorWallet]) // etc
}

model CommissionLogArchive {
   // ...
}
```

## 2. Archiving Script (`scripts/archive-data.ts`)
A standalone TypeScript script executable via `tsx`.

### Logic
1.  **Retention Policy**: `RETENTION_DAYS = 90`.
2.  **Batch Processing**:
    *   Query `take: 1000` records where `createdAt < cutoff` AND `status IN ['EXECUTED', 'SKIPPED', 'FAILED']`.
    *   Loop until 0 records found.
3.  **Transaction**:
    *   For each batch:
    *   `prisma.$transaction([ createMany(Archive), deleteMany(Main) ])`
    *   **Note**: `createMany` is supported in Postgres.
4.  **Safety**:
    *   If `CopyTrade` has relations (e.g. `FeeTransaction`?), we must ensure those are handled.
    *   Current Schema Check: `CopyTrade` is a child of `Config`. It doesn't seem to be a parent of other critical tables (Checked schema: `CommissionLog` has `sourceTradeId`, but it's not a Foreign Key relation, just a String).
    *   **Constraint**: `idempotencyKey` is unique. Archive table should also have unique constraint? Yes, to prevent double archiving.

## 3. Scheduling
The user can run this via `cron` or manually. We will provide the script.
Command: `npm run archive-data`

## 4. UI/API Impact
*   **Stats**: Aggregated stats (Total Volume, Profit) should be stored in `UserProxy` or `CopyTradingConfig` (which they are: `totalVolume`, `totalProfit`).
*   **Result**: Archiving `CopyTrade` rows **should not** affect the "Total Profit" displayed on the dashboard, as those are pre-aggregated.
*   **History**: The "Trade History" list will simply stop showing trades older than 90 days. This is acceptable performance trade-off.
