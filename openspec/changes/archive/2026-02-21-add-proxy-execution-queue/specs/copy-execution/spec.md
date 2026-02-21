## ADDED Requirements
### Requirement: Proxy-Scoped Execution Serialization
The system SHALL serialize fund-management and settlement operations per proxy address to avoid overlapping balance changes while allowing parallel execution across different proxies.

#### Scenario: Same proxy serialized
- **GIVEN** two executions target the same proxy address
- **WHEN** they perform fund pulls/returns or settlement actions
- **THEN** those operations are serialized in a proxy-scoped queue

#### Scenario: Different proxies parallelized
- **GIVEN** two executions target different proxy addresses
- **WHEN** they perform fund pulls/returns or settlement actions
- **THEN** the system allows parallel execution without waiting on the same proxy queue
