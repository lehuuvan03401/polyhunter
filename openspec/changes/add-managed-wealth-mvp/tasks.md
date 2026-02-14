## 1. Specification & Data Model
- [x] 1.1 Add Prisma models for managed products, terms, subscriptions, NAV snapshots, settlements, reserve fund ledger, and risk events.
- [x] 1.2 Add DB indexes for subscription status scans, NAV fetches, settlement scans, and reserve ledger reporting.
- [x] 1.3 Add migration and backfill/seed script for initial products and term matrix.

## 2. API Layer
- [x] 2.1 Implement `GET /api/managed-products` and `GET /api/managed-products/:id`.
- [x] 2.2 Implement `POST /api/managed-subscriptions` with terms acceptance and eligibility checks.
- [x] 2.3 Implement `GET /api/managed-subscriptions` and `GET /api/managed-subscriptions/:id/nav`.
- [x] 2.4 Implement settlement endpoints: `POST /api/managed-settlement/run`, `GET /api/managed-settlements/:subscriptionId`.
- [x] 2.5 Implement ops endpoint `GET /api/reserve-fund/summary`.

## 3. Execution & Lifecycle Jobs
- [x] 3.1 Map active managed subscriptions to isolated copy-trading execution configs.
- [x] 3.2 Implement periodic NAV snapshot job with pricing fallback tagging.
- [x] 3.3 Implement maturity scanner and idempotent settlement job.
- [x] 3.4 Implement reserve-fund top-up/deduction entries for conservative guarantee shortfall.
- [x] 3.5 Enforce pause of new guaranteed subscriptions when reserve coverage ratio is below threshold.

## 4. Frontend Experience
- [x] 4.1 Add `托管理财` entry and product marketplace page.
- [x] 4.2 Build product detail page with terms, drawdown policy, guarantee clause, and fee split.
- [x] 4.3 Build subscription flow modal/form with explicit risk/terms confirmations.
- [x] 4.4 Build `我的托管` dashboard for NAV, drawdown, timeline, and settlement history.
- [x] 4.5 Implement disclosure policy rendering (realtime vs delayed details).

## 5. Validation
- [x] 5.1 Unit tests for HWM fee, guarantee shortfall, and settlement math.
- [x] 5.2 Integration tests for subscribe -> run -> mature -> settle lifecycle.
- [x] 5.3 E2E tests for user subscription flow and settlement visibility.
- [x] 5.4 Add runbook section for reserve-fund operations and emergency controls.
