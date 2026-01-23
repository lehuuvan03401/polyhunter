# Change: Migrate to PostgreSQL

## Why
The current SQLite-based database (using LibSQL adapter) suffers from severe locking contention (P1008 timeouts) during high-frequency write operations, such as copy trading simulations or live high-volume trading. SQLite's single-writer lock model is insufficient for the concurrent workload of the Supervisor, API, and Simulation scripts running simultaneously.

To verify the system end-to-end reliability and support production-grade concurrency, we must migrate to a database engine that supports non-blocking concurrent reads/writes, such as PostgreSQL.

## What Changes
- **Database Engine**: Switch from SQLite (`file:dev.db`) to PostgreSQL `postgres://...`).
- **Adapter**: Remove `@prisma/adapter-libsql` and use the native Prisma PostgreSQL driver.
- **Environment**: Require `DATABASE_URL` to be a valid PostgreSQL connection string.
- **Schema**: Update `prisma/schema.prisma` provider to `postgresql`.

## Impact
- **Affected specs**: `storage` (New capability)
- **Affected code**:
  - `prisma/schema.prisma`
  - `lib/prisma.ts`
  - `.env` (configuration)
  - `package.json` (remove libsql dependencies)
