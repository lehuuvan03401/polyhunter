## ADDED Requirements

### Requirement: Supervisor Dead-Letter Queue MUST Be Operable
The project SHALL provide operational tooling to inspect and recover supervisor dead-letter queue entries.

#### Scenario: Operator inspects DLQ safely
- **GIVEN** DLQ contains failed queue entries
- **WHEN** operator runs DLQ inspect command
- **THEN** the tool returns queue/DLQ state and DLQ entry summaries without mutating queue data

#### Scenario: Operator replays filtered DLQ entries
- **GIVEN** DLQ contains replayable entries
- **WHEN** operator runs replay command with optional filters
- **THEN** matching entries are moved back to active queue
- **AND** replay supports dry-run mode to preview actions before mutation

#### Scenario: Operator purges stale DLQ entries
- **GIVEN** DLQ contains entries no longer needed
- **WHEN** operator runs purge command
- **THEN** configured number of stale entries are removed
- **AND** dry-run mode is supported
