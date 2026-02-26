## Context
Horus already supports managed-wealth subscriptions, membership plans, affiliate referrals, and copy-trading execution. The new external policy introduces stricter and broader business rules across these domains, including funding channels, fixed fee model, V1-V9 team incentives, and a capped global partner seat system.

## Goals
- Translate external policy into explicit system contracts.
- Reuse existing managed-wealth and affiliate foundations where possible.
- Keep security defaults non-custodial; require explicit authorization for managed custody behavior.
- Make leveling, dividends, and partner-seat governance auditable and automatable.

## Non-Goals
- Rewriting copy-trading execution architecture.
- Changing existing Polymarket/CTF on-chain integration primitives.
- Immediate removal of legacy affiliate tiers until migration and backfill are validated.

## Key Decisions
1. **Policy as configuration, not hardcoded logic**
   - Return matrix, level thresholds, dividend rates, and elimination parameters are stored in DB/config tables to allow operational adjustments.

2. **Net deposit is the single performance base**
   - `netDeposit = totalDeposits - totalWithdrawals` is materialized per wallet/team and snapshotted daily for deterministic level evaluation.

3. **Fixed 20% realized-profit fee**
   - Existing volume-based fee tiers are replaced by a single realized-profit fee rate for both FREE and MANAGED modes.

4. **Separate partner-seat state machine**
   - Global partner seats are managed through dedicated entities (`ACTIVE`, `ELIMINATED`, `REFUND_PENDING`, `REFUNDED`, `OPEN_FOR_REFILL`) to avoid overloading affiliate models.

5. **Custody boundary remains explicit**
   - FREE mode stays non-custodial (user wallet/proxy controlled by user).
   - MANAGED mode requires explicit custody authorization capture, audit trails, and revocation support.

## Data Model Additions (Expected)
- `ParticipationAccount` / `ParticipationFundingRecord` for activation and funding channels.
- `ManagedReturnMatrix` for A/B/C principal bands × terms × strategies.
- `NetDepositLedger` + `DailyLevelSnapshot` for V1-V9.
- `PartnerSeat`, `PartnerMonthlyRank`, `PartnerElimination`, `PartnerRefund` for seat governance.

## Processing Flows
1. **Activation Flow**
   - register -> ingest deposit (exchange/TP) -> normalize MCN equivalent -> validate min threshold -> activate account mode.

2. **Fee & Settlement Flow**
   - copy/managed trade closes -> realized profit computed -> fee `= max(profit,0) * 20%` -> affiliate/team distribution.

3. **Daily Growth Evaluation**
   - aggregate net deposits -> compute V-level -> apply dividend eligibility -> persist snapshot for audit and payout.

4. **Monthly Partner Cycle**
   - generate ranking snapshot -> eliminate bottom 10 -> enqueue refunds (deadline +7 days) -> open refill seats with current configured price.

## Risks & Mitigations
- **Rule conflicts with legacy affiliate tiers**
  - Mitigation: dual-run period with reconciliation report before full cutover.
- **Custody compliance risk**
  - Mitigation: signed consent payload, immutable audit logs, explicit revocation API.
- **Partner elimination disputes**
  - Mitigation: persisted ranking snapshots and deterministic tie-break rules.
- **Financial reconciliation drift**
  - Mitigation: daily settlement checks and discrepancy alerts.

## Open Questions
- Define canonical source for exchange-channel deposit confirmation (webhook vs manual reconciliation).
- Confirm whether the 1-day newcomer free period waives only subscription fees or also performance fees.
- Confirm tie-break and timezone policy for monthly partner ranking cutoff.
