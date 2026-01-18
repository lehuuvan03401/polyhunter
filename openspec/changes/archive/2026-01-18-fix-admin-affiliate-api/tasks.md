# Tasks: Fix Admin Affiliate API

## 1. Query Optimization
- [x] 1.1 Replace N+1 `teamSize` queries with batch `groupBy` aggregation
- [x] 1.2 Verify response time improvement with 20+ affiliates

## 2. Input Validation
- [x] 2.1 Add `VALID_TIERS` constant array
- [x] 2.2 Validate tier in PUT handler before database update
- [x] 2.3 Return 400 error for invalid tier values

## 3. Security Hardening
- [x] 3.1 Add startup warning if `ADMIN_WALLETS` not configured in production
- [x] 3.2 Log admin action attempts for audit trail

## 4. Verification
- [x] 4.1 Test GET endpoint performance with batch query
- [x] 4.2 Test PUT endpoint with invalid tier (expect 400)
- [x] 4.3 Test production mode without ADMIN_WALLETS
