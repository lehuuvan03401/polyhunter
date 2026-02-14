## ADDED Requirements

### Requirement: Persistent Signal Cursor Storage
The system SHALL persist polling cursor/watermark state in relational storage so ingestion can resume safely after restart.

#### Scenario: Restart-safe polling resume
- **GIVEN** a supervisor instance persisted cursor `C1`
- **WHEN** the process restarts
- **THEN** polling resumes from `C1` (or bounded replay window before `C1`)
- **AND** it avoids full-history replay

#### Scenario: Cursor update durability
- **GIVEN** a polling cycle processes events successfully
- **WHEN** cursor write is committed
- **THEN** subsequent cycles read the updated cursor
- **AND** no duplicate processing occurs after restart
