## ADDED Requirements

### Requirement: Guardrail Event Persistence
The system SHALL persist guardrail trigger events for audit and monitoring.

#### Scenario: Persisting guardrail events
- **WHEN** a guardrail blocks an execution
- **THEN** a guardrail event record is stored
- **AND** the record includes reason, source, wallet address (if any), amount (if any), trade id (if any), token id (if any), and timestamp
