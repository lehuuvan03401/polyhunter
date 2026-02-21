## ADDED Requirements
### Requirement: Worker Pool Isolation
The system SHALL support multiple worker keys for copy-trade execution and record which worker executed each trade.

#### Scenario: Worker selection
- **GIVEN** multiple worker keys are configured
- **WHEN** the worker starts
- **THEN** it selects a specific worker key deterministically

#### Scenario: Execution attribution
- **GIVEN** a copy trade is executed
- **WHEN** the execution completes
- **THEN** the trade record stores the worker address in `executedBy`
