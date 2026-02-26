## MODIFIED Requirements

### Requirement: Affiliate Commission Trigger
The system MUST ONLY trigger commission distribution when a copy-trade or managed-trade closes with realized profit for the participant. For managed settlements, this trigger MUST be consistent across manual withdrawal, worker auto-settlement, and admin settlement entrypaths.

#### Scenario: Worker-managed settlement results in profit
- **GIVEN** managed subscription settles through worker path
- **AND** realized profit is greater than zero
- **WHEN** settlement is finalized
- **THEN** commission distribution is triggered exactly once

#### Scenario: Admin-managed settlement results in profit
- **GIVEN** managed subscription settles through admin batch path
- **AND** realized profit is greater than zero
- **WHEN** settlement is finalized
- **THEN** commission distribution is triggered exactly once

#### Scenario: Duplicate trigger attempt across paths
- **GIVEN** same settlement event is retried or reached by multiple entrypaths
- **WHEN** commission trigger is evaluated
- **THEN** idempotency guard prevents duplicate commission distribution

