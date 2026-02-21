## ADDED Requirements
### Requirement: RPC Failover
The system SHALL support multiple RPC URLs for copy-trading execution and automatically fail over to a healthy RPC when the primary is unavailable.

#### Scenario: Primary RPC unhealthy
- **GIVEN** the primary RPC is unreachable
- **WHEN** the worker initializes the execution provider
- **THEN** it selects the first healthy fallback RPC

#### Scenario: Failover logging
- **GIVEN** a failover occurs
- **WHEN** a fallback RPC is selected
- **THEN** the system logs the selected RPC URL
