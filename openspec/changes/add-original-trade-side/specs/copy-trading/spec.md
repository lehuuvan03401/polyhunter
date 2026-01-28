## ADDED Requirements
### Requirement: Preserve Leader Side
The system SHALL persist the leader's original trade side separately from the executed copy side.

#### Scenario: Counter strategy preserves original side
- **GIVEN** a leader executes a BUY trade
- **AND** the copy config is COUNTER
- **WHEN** the copy trade is recorded
- **THEN** `leaderSide` is stored as BUY
- **AND** `originalSide` reflects the executed side (SELL)
