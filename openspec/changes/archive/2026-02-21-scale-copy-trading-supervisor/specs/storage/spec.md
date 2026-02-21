# storage Spec Delta (Scale Copy Trading Supervisor)

## ADDED Requirements

### Requirement: Shared Low-Latency Store
The system SHALL provide a shared low-latency store for dedup keys, queue state, and guardrail counters.

#### Scenario: Multi-instance deduplication
- **GIVEN** multiple supervisor instances are running
- **WHEN** a dedup key is written by one instance
- **THEN** other instances read the same key within milliseconds

#### Scenario: Queue durability
- **GIVEN** a supervisor process crashes while jobs are queued
- **WHEN** a new instance starts
- **THEN** pending jobs remain available for processing
