# Implement Data Archiving

## Problem
The `CopyTrade` and `CommissionLog` tables are append-only and grow indefinitely. As they reach millions of rows, query performance (even with indexes) will degrade, and storage costs will increase. Most queries only care about recent data (last 30-90 days).

## Solution
Implement a **Data Archiving Strategy**:
1.  **Schema**: Create `CopyTradeArchive` and `CommissionLogArchive` tables in Prisma. These mirror the main tables but are meant for cold storage.
2.  **Automation**: Create a `scripts/archive-data.ts` script to run periodically.
3.  **Logic**:
    *   Identify records older than a retention period (e.g., 90 days).
    *   Ensure records are in a final state (e.g., `EXECUTED`, `SKIPPED`, `FAILED`).
    *   Move (Insert + Delete) them to the archive tables in a transaction.

## Risks
*   **Transaction Size**: Deleting massive amounts of data at once can lock tables. The script must process in batches (e.g., 1000 records at a time).
*   **Data Availability**: Archived data will no longer be visible in standard API queries unless endpoint logic is updated to query the archive table (usually not required for "Active" views).

## Alternatives
*   **Partitioning**: PostgreSQL native partitioning. Powerful but complex to manage with Prisma (requires raw SQL migrations).
*   **S3 Dump**: Dump to CSV/JSON and delete. Cheaper, but harder to query later if needed for audits. **Decision**: DB Table Archiving is the best middle ground for now—easy to query if needed, keeps main table fast.
