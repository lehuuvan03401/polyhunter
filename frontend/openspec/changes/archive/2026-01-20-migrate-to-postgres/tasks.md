# Tasks: Migrate to PostgreSQL

## 1. Dependency & Configuration Updates
- [x] 1.1 Remove `@prisma/adapter-libsql` and `@libsql/client` from `package.json`
- [x] 1.2 Update `prisma/schema.prisma` datasource provider to `postgresql`
- [x] 1.3 Update `lib/prisma.ts` to remove LibSQL adapter initialization

## 2. Infrastructure Setup
- [x] 2.1 Update `.env` with `DATABASE_URL` pointing to local PostgreSQL instance
- [x] 2.2 Verify PostgreSQL connection

## 3. Migration Execution
- [x] 3.1 Run `npx prisma migrate dev --name init_postgres` to create schema in PG
- [x] 3.2 (Optional) Seed initial data if required

## Verification
- [x] Run 1-minute simulation to ensure DB connectivity
- [x] Verify no P1008 errors (implicit in success)
