# Change: Fix Admin Affiliate API Performance & Security

## Why
The admin affiliates API endpoint has performance issues (N+1 queries) and security gaps (missing input validation, dev mode bypass) that need addressing before production use.

## What Changes
- **Query Optimization**: Replace N+1 teamSize queries with batch aggregation
- **Input Validation**: Add tier enum validation in PUT endpoint
- **Security Hardening**: Add production startup check for ADMIN_WALLETS configuration

## Impact
- **Affected specs**: `affiliate-system`
- **Affected code**: `frontend/app/api/admin/affiliates/route.ts`
