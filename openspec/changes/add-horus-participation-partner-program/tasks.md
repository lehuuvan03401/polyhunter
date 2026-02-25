## 1. Rules & Data Model
- [x] 1.1 Add enums/config tables for participation mode (`FREE`/`MANAGED`), funding channels, strategy profiles, and service periods.
- [x] 1.2 Add managed return matrix storage keyed by principal band (A/B/C), term (7/30/90/180/360), and strategy.
- [x] 1.3 Add net-deposit ledger/aggregation model to support daily V1-V9 evaluation.
- [ ] 1.4 Add global partner seat models (seat status, ranking snapshot, elimination record, refund record, refill pricing).

## 2. Funding & Activation Flow
- [x] 2.1 Implement exchange funding ingestion and TP wallet funding ingestion with unified MCN-equivalent amount normalization.
- [x] 2.2 Implement participation activation gate: registration + qualified deposit required.
- [x] 2.3 Enforce minimum thresholds: `FREE >= 100U`, `MANAGED >= 500U`.

## 3. Managed/FREE Service Logic
- [ ] 3.1 Align strategy options to Conservative/Moderate/Aggressive across API, worker, and UI.
- [x] 3.2 Restrict selectable managed terms to 7/30/90/180/360 and preserve 1-day trial behavior.
- [x] 3.3 Serve managed yield matrix by principal band and strategy for UI/marketing rendering.
- [x] 3.4 Add explicit custody authorization contract/API flow for `MANAGED` mode.

## 4. Fee & Subscription Rules
- [x] 4.1 Replace variable profit fee tiers with fixed 20% realized-profit fee for both `FREE` and `MANAGED`.
- [ ] 4.2 Keep no-profit no-fee invariant end-to-end (execution, settlement, affiliate commission trigger).
- [ ] 4.3 Ensure membership pricing remains `88/month`, `228/quarter`, and MCN payment applies 50% discount.
- [ ] 4.4 Enforce one active membership per wallet and preserve 1-day newcomer basic-service trial.

## 5. Referral & Performance Growth System
- [ ] 5.1 Keep one-time direct referral reward: first qualified participation extends referrer by exactly 1 day.
- [x] 5.2 Add daily V1-V9 level engine based on team net deposits and configured thresholds.
- [x] 5.3 Implement team profit dividend rates per V-level (V1=30% ... V9=70%).
- [ ] 5.4 Implement same-level bonus settlement: first generation 4%, second generation 1%.
- [ ] 5.5 Implement double-zone promotion metric and progress APIs.

## 6. Global Partner Program
- [ ] 6.1 Enforce 100-seat hard cap with no over-allocation.
- [ ] 6.2 Implement monthly ranking snapshot and automatic elimination for bottom 10 seats.
- [ ] 6.3 Implement refund SLA pipeline (refund within 7 days after elimination).
- [ ] 6.4 Implement seat refill workflow with market-configurable price.
- [ ] 6.5 Grant/revoke partner privileges (V5-equivalent rights + dedicated backend permissions).

## 7. API & Frontend Delivery
- [x] 7.1 Add participation rules APIs (funding channels, thresholds, terms, yield matrix, fee summary).
- [ ] 7.2 Add partner program APIs (seat list, ranking, elimination, refund progress, refill queue).
- [ ] 7.3 Update managed-wealth and affiliate UI with formal external-rule presentation.
- [ ] 7.4 Add admin operations pages for partner seat governance and refund handling.

## 8. Verification & Rollout
- [ ] 8.1 Add unit tests for fee calculation, net-deposit aggregation, V-level mapping, same-level bonuses.
- [ ] 8.2 Add integration tests for activation, referral bonus one-time guard, and partner elimination/refund workflow.
- [ ] 8.3 Add E2E flows for FREE vs MANAGED onboarding and partner-seat operations.
- [x] 8.4 Run `openspec validate add-horus-participation-partner-program --strict --no-interactive`.
- [ ] 8.5 Publish operations runbook updates (monthly elimination cadence, refund SLA, incident handling).
