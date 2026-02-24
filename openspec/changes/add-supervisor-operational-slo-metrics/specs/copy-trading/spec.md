## ADDED Requirements

### Requirement: Supervisor Must Emit Operational SLO Summaries
The supervisor SHALL emit rolling operational summaries that include queue-tail latency, rejection distribution, wallet-level execution quality, and reconciliation drift.

#### Scenario: Queue tail is reported
- **GIVEN** jobs are enqueued and dequeued
- **WHEN** periodic supervisor metrics summary runs
- **THEN** summary includes queue lag `p95` and max lag values

#### Scenario: Reject reason distribution is reported
- **GIVEN** trades are rejected across guardrail/filter/orchestrator paths
- **WHEN** periodic supervisor metrics summary runs
- **THEN** summary includes reject total and top reject reasons for the current window

#### Scenario: Wallet-level execution quality is reported
- **GIVEN** multiple wallets receive copy-trade execution attempts
- **WHEN** periodic supervisor metrics summary runs
- **THEN** summary includes per-wallet success/fail/skip counts and success rate

#### Scenario: Reconciliation drift is reported
- **GIVEN** SELL accounting reconciliation runs
- **WHEN** periodic supervisor metrics summary runs
- **THEN** summary includes reconciliation runs/errors and absolute-diff aggregates (`totalAbsDiff`, `maxAbsDiff`)
