# Design: Migrate to PostgreSQL

## Context
The project initially used SQLite for ease of local development. However, copy trading simulations revealed that SQLite's locking mechanism causes failures (P1008) under concurrent load (API reads vs Simulation writes).

## Goals
- Eliminate P1008 "Database locked" timeouts.
- Support high-concurrency write/read workloads.
- Prepare codebase for production deployment where Postgres is the standard.

## Decisions
- **Decision**: Switch to PostgreSQL.
  - **Why**: Industry standard, excellent concurrency control (MVCC), native Prisma limits are higher.
- **Decision**: Remove LibSQL adapter.
  - **Why**: LibSQL was used for SQLite compatibility; not needed for standard Postgres.

## Migration Plan
1. **Code**: Switch provider in schema and init logic.
2. **Data**: We will NOT migrate existing SQLite data (it's mostly simulation/test data). We will start with a fresh Postgres database.
3. **Local Dev**: Developers must run a local Postgres instance (e.g., via Docker or Postgres.app).

## Risks
- **Risk**: Local dev environment setup becomes more complex (requires PG).
  - **Mitigation**: Document required PG setup or provide docker-compose (future).
