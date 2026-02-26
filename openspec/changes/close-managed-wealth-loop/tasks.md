## 1. Data model and migration
- [ ] 1.1 Add subscription-scoped allocation model (`ManagedSubscriptionAllocation`) with versioning and score snapshots.
- [x] 1.2 Add managed principal reservation ledger for subscription-level reserved/released amounts.
- [x] 1.3 Add execution scope isolation for positions (extend `UserPosition` with scope key or introduce dedicated managed position model).
- [x] 1.4 Add settlement execution/idempotency record to unify settlement + commission status transitions.

## 2. Allocation and execution loop
- [ ] 2.1 Implement score-based trader candidate pipeline from leaderboard/scoring services by strategy profile.
- [ ] 2.2 Implement weighted-random assignment per subscription with deterministic seed persistence.
- [ ] 2.3 Support multi-trader allocation per managed subscription and controlled rebalance behavior.
- [ ] 2.4 Update managed worker to consume allocation snapshots instead of static primary-agent mapping.

## 3. Liquidation and settlement parity
- [ ] 3.1 Replace synthetic liquidation records with real executable liquidation path (or explicit pending retry state).
- [x] 3.2 Refactor settlement into shared domain service used by withdraw API, worker, and admin settlement API.
- [x] 3.3 Enforce commission distribution trigger parity for profitable managed settlements in all entrypaths.
- [x] 3.4 Add idempotency guard for settlement + profit-fee distribution event pair.

## 4. Participation boundary and principal linkage
- [x] 4.1 Enforce managed subscription creation against available managed principal reservation balance.
- [x] 4.2 Ensure custody authorization + principal reservation references are auditable from subscription detail.
- [x] 4.3 Reject managed operations when mode boundary or reservation constraints are not satisfied.

## 5. Frontend and operator visibility
- [ ] 5.1 Surface allocation snapshot summary in managed product detail/subscription surfaces.
- [ ] 5.2 Show explicit principal band/minimum constraints in subscription flow.
- [x] 5.3 Add operations panel/endpoint for loop health: allocation status, liquidation backlog, settlement/commission parity.

## 6. Validation and rollout
- [ ] 6.1 Add unit tests for allocation determinism, scope-isolated accounting, and settlement idempotency.
- [ ] 6.2 Add integration tests for full managed lifecycle parity across settlement entrypoints.
- [ ] 6.3 Add E2E coverage for one-click managed subscription through settlement and commission completion.
- [ ] 6.4 Stage rollout with feature flags and rollback switches for worker and settlement service path.
