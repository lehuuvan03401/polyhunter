## ADDED Requirements
### Requirement: Execution Monitoring
The system SHALL emit periodic execution metrics and warnings for low balances during real copy trading.

#### Scenario: Metrics summary
- **GIVEN** copy trading is running
- **WHEN** the metrics interval elapses
- **THEN** the system logs success rate, latency, and failure reasons

#### Scenario: Balance warning
- **GIVEN** the worker or proxy balance falls below a configured threshold
- **WHEN** the check runs
- **THEN** the system logs a warning
