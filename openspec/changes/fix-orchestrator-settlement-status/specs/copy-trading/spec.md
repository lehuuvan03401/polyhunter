## ADDED Requirements

### Requirement: Execution Status Reflects Settlement State
The system SHALL persist successful copy-trade execution status based on settlement completion state.

#### Scenario: Deferred settlement is pending
- **GIVEN** a copy trade execution succeeds
- **AND** settlement is deferred or settlement transfer confirmation is unavailable
- **WHEN** the orchestrator finalizes trade status
- **THEN** the trade status is `SETTLEMENT_PENDING`
- **AND** the trade error message indicates settlement is pending

#### Scenario: Settled execution is final
- **GIVEN** a copy trade execution succeeds
- **AND** settlement transfer confirmation is available
- **WHEN** the orchestrator finalizes trade status
- **THEN** the trade status is `EXECUTED`
- **AND** the trade error message is cleared
