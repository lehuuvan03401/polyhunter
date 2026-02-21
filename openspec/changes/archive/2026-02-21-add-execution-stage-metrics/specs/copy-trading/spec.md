## ADDED Requirements
### Requirement: Execution Stage Metrics
The system SHALL record latency metrics for each execution stage (prewrite, guardrails, pricing, preflight, execution, persistence) and log aggregated stats at the metrics interval.

#### Scenario: Stage metrics logged for successful execution
- **GIVEN** a copy trade executes successfully
- **WHEN** the metrics interval elapses
- **THEN** the metrics summary includes per-stage counts and average latency

#### Scenario: Stage metrics logged for failed execution
- **GIVEN** a copy trade fails during preflight
- **WHEN** the metrics interval elapses
- **THEN** the metrics summary includes the completed stage timings and zero counts for later stages
