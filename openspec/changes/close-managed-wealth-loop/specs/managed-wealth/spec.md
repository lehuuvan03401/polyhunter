## ADDED Requirements

### Requirement: Score-Based Weighted-Random Trader Allocation
The system SHALL allocate managed subscription execution targets from a scored candidate pool by strategy profile using weighted-random selection with deterministic seed persistence.

#### Scenario: Subscription receives allocation snapshot
- **GIVEN** a user creates a managed subscription
- **WHEN** allocation is generated
- **THEN** the system stores allocation version, candidate scores, random seed, and selected trader weights
- **AND** selected allocation is auditable for replay

#### Scenario: Allocation candidate changes over time
- **GIVEN** a subscription is active
- **AND** a selected trader no longer passes strategy/risk filters
- **WHEN** reallocation runs
- **THEN** the system creates a new allocation version with reason and timestamp

### Requirement: Subscription-Scoped Execution Accounting
Managed execution accounting MUST be isolated per subscription scope. The system MUST NOT aggregate managed positions purely by wallet address.

#### Scenario: Same wallet has multiple managed subscriptions
- **GIVEN** wallet W has subscription S1 and S2
- **WHEN** both subscriptions trade the same token
- **THEN** position, NAV, drawdown, and settlement accounting for S1 and S2 remain isolated

#### Scenario: FREE and MANAGED flows share wallet
- **GIVEN** wallet W has FREE-mode copy-trading and MANAGED subscription
- **WHEN** both flows trade overlapping markets
- **THEN** managed settlement calculations use managed scope only

### Requirement: Managed Principal Reservation Linkage
Managed subscription creation SHALL reserve principal from managed-qualified balance and persist reservation events for release/reconciliation.

#### Scenario: Sufficient managed balance allows subscription
- **GIVEN** wallet has available managed-qualified balance above requested principal
- **WHEN** user confirms managed subscription
- **THEN** principal is reserved and reservation ledger is recorded

#### Scenario: Insufficient managed balance rejects subscription
- **GIVEN** wallet managed-qualified available balance is below requested principal
- **WHEN** user submits subscription
- **THEN** request is rejected with reservation/balance validation error

### Requirement: Unified Settlement Path
All managed settlement entrypaths SHALL execute the same settlement domain workflow and state machine.

#### Scenario: Manual withdrawal settlement
- **WHEN** managed settlement is triggered from user withdrawal endpoint
- **THEN** the shared settlement workflow is used

#### Scenario: Worker or admin settlement
- **WHEN** managed settlement is triggered by worker or admin batch endpoint
- **THEN** the same shared settlement workflow is used

### Requirement: Real Liquidation Integrity
Managed subscriptions with open exposure at maturity MUST use real liquidation execution before settlement finalization.

#### Scenario: Maturity with open positions
- **GIVEN** subscription reaches maturity with open exposure
- **WHEN** settlement is attempted
- **THEN** subscription enters liquidation state
- **AND** settlement finalization waits for executable liquidation completion

#### Scenario: Liquidation execution failure
- **GIVEN** liquidation execution fails
- **WHEN** retry limit not reached
- **THEN** subscription remains in recoverable liquidation state with explicit error reason

### Requirement: Loop Observability
The system SHALL emit loop-level metrics and reconciliation status for allocation, liquidation, settlement, and commission distribution parity.

#### Scenario: Settlement completed without commission
- **GIVEN** a profitable managed settlement is completed
- **WHEN** commission distribution fails or is skipped
- **THEN** system emits reconciliation error signal for operator action

