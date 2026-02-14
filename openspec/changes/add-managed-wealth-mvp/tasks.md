## 1. Specification & Data Model
- [ ] 1.1 Add Prisma models for managed products, terms, subscriptions, NAV snapshots, settlements, reserve fund ledger, and risk events.
- [ ] 1.2 Add DB indexes for subscription status scans, NAV fetches, settlement scans, and reserve ledger reporting.
- [ ] 1.3 Add migration and backfill/seed script for initial products and term matrix.

## 2. API Layer
- [ ] 2.1 Implement `GET /api/managed-products` and `GET /api/managed-products/:id`.
- [ ] 2.2 Implement `POST /api/managed-subscriptions` with terms acceptance and eligibility checks.
- [ ] 2.3 Implement `GET /api/managed-subscriptions` and `GET /api/managed-subscriptions/:id/nav`.
- [ ] 2.4 Implement settlement endpoints: `POST /api/managed-settlement/run`, `GET /api/managed-settlements/:subscriptionId`.
- [ ] 2.5 Implement ops endpoint `GET /api/reserve-fund/summary`.

## 3. Execution & Lifecycle Jobs
- [ ] 3.1 Map active managed subscriptions to isolated copy-trading execution configs.
- [ ] 3.2 Implement periodic NAV snapshot job with pricing fallback tagging.
- [ ] 3.3 Implement maturity scanner and idempotent settlement job.
- [ ] 3.4 Implement reserve-fund top-up/deduction entries for conservative guarantee shortfall.
- [ ] 3.5 Enforce pause of new guaranteed subscriptions when reserve coverage ratio is below threshold.

## 4. Frontend Experience
- [ ] 4.1 Add `托管理财` entry and product marketplace page.
- [ ] 4.2 Build product detail page with terms, drawdown policy, guarantee clause, and fee split.
- [ ] 4.3 Build subscription flow modal/form with explicit risk/terms confirmations.
- [ ] 4.4 Build `我的托管` dashboard for NAV, drawdown, timeline, and settlement history.
- [ ] 4.5 Implement disclosure policy rendering (realtime vs delayed details).

## 5. Validation
- [ ] 5.1 Unit tests for HWM fee, guarantee shortfall, and settlement math.
- [ ] 5.2 Integration tests for subscribe -> run -> mature -> settle lifecycle.
- [ ] 5.3 E2E tests for user subscription flow and settlement visibility.
- [ ] 5.4 Add runbook section for reserve-fund operations and emergency controls.
