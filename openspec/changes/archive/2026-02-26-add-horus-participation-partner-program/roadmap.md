# Roadmap: Horus Participation + Global Partner Program

## Delivery Strategy
- **M1 (Foundation & Policy Alignment)**: build the minimum compliant backbone (data model, activation gate, fixed fee policy, baseline APIs).
- **M2 (Growth Engine)**: implement V1-V9 net-deposit progression, same-level bonuses, and promotion metrics.
- **M3 (Global Partner Ops)**: launch seat governance, elimination/refund workflow, and partner admin operations.

## Planning Assumptions (for scheduling)
- Exchange funding confirmation uses webhook as primary path, manual reconciliation as fallback.
- 1-day newcomer trial waives membership/basic service fee only; profit-fee logic remains no-profit-no-fee and 20% on realized profit.
- Monthly ranking cutoff timezone defaults to `Asia/Shanghai` and is configurable (`PARTNER_RANK_TZ`).

## Milestones

### M1: Foundation & Policy Alignment (Target: 2.5 weeks)
**Goal**: make participation flow and fee model externally publishable and technically enforceable.

**Scope (from tasks.md)**
- 1.1, 1.2, partial 1.3 (wallet-level ledger only)
- 2.1, 2.2, 2.3
- 3.1, 3.2, 3.3, 3.4 (MVP authorization trail)
- 4.1, 4.2, 4.3, 4.4
- 7.1 (participation rules APIs)
- 8.1 (fee + threshold unit tests), partial 8.2 (activation + referral one-time guard)

**Key deliverables**
- Participation account activation with dual funding channels.
- FREE/MANAGED minimum threshold enforcement.
- Managed return matrix API (A/B/C × term × strategy).
- Fixed 20% realized-profit fee applied in FREE/MANAGED paths.
- Existing membership pricing and trial/referral behavior preserved.

**Estimated effort**
- Backend: 13 dev-days
- Frontend: 5 dev-days
- QA/Automation: 4 dev-days
- DevOps/DB migration support: 2 dev-days
- **Total: ~24 dev-days**

### M2: Growth Engine (Target: 2 weeks)
**Goal**: deliver performance-driven growth mechanics (net deposit, V-levels, team split rules).

**Scope (from tasks.md)**
- Remaining 1.3
- 5.2, 5.3, 5.4, 5.5
- 7.3 (affiliate/managed rule presentation updates)
- 8.1 (level/bonus tests), 8.2 (growth engine integration tests)

**Key deliverables**
- Daily net-deposit aggregation + snapshot engine.
- V1-V9 automatic level mapping with configured thresholds.
- Team dividend rate application (30%-70%).
- Same-level bonus payout (1st gen 4%, 2nd gen 1%).
- Double-zone promotion progress APIs.

**Estimated effort**
- Backend: 11 dev-days
- Frontend: 4 dev-days
- QA/Automation: 4 dev-days
- Data/Finance reconciliation: 2 dev-days
- **Total: ~21 dev-days**

### M3: Global Partner Program (Target: 2 weeks)
**Goal**: operationalize 100-seat governance with monthly elimination and refund SLA.

**Scope (from tasks.md)**
- 1.4
- 6.1, 6.2, 6.3, 6.4, 6.5
- 7.2, 7.4
- 8.2 (partner elimination/refund integration), 8.3, 8.5

**Key deliverables**
- Seat cap enforcement at 100.
- Monthly bottom-10 elimination job + immutable ranking snapshot.
- Refund pipeline with 7-day SLA tracking and alerts.
- Refill workflow with configurable seat price.
- Partner privilege binding/revocation (V5-equivalent + console access).

**Estimated effort**
- Backend: 12 dev-days
- Frontend/Admin: 6 dev-days
- QA/E2E: 5 dev-days
- Ops/Runbook/Alerting: 3 dev-days
- **Total: ~26 dev-days**

## Critical Path Dependencies
1. Data model migrations (M1) must land before growth/partner engines.
2. Fee model cutover (M1) must complete before V-level dividend settlement (M2).
3. Net-deposit ledger accuracy (M2) is prerequisite for partner ranking fairness (M3).
4. Admin auth and audit logging baseline (M1) is prerequisite for elimination/refund operations (M3).

## Release Gates
- **Gate A (end of M1)**: activation + fee + matrix + baseline tests green in staging.
- **Gate B (end of M2)**: level/bonus reconciliation report passes for at least 7 simulated daily cycles.
- **Gate C (end of M3)**: monthly elimination dry-run + refund SLA drill completed.

## Suggested Team Shape
- 2 Backend engineers (core APIs, worker/jobs, settlement/ledger)
- 1 Frontend engineer (managed/affiliate/partner UI)
- 1 QA engineer (integration + e2e)
- 0.5 DevOps/DB support (migration, monitoring, cron safety)

