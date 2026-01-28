## ADDED Requirements
### Requirement: Execution Retry Queue
The system SHALL retry transient execution failures with a bounded retry queue and backoff.

#### Scenario: Retry on transient failure
- **GIVEN** a copy trade fails with a transient RPC error
- **WHEN** the retry scheduler runs
- **THEN** the trade is retried up to the maximum attempts

#### Scenario: Stop after max attempts
- **GIVEN** a trade has reached the max retry attempts
- **WHEN** the scheduler runs
- **THEN** it does not attempt further retries
