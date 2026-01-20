## ADDED Requirements

### Requirement: Relational Database Storage
The system SHALL use a robust relational database capable of handling high-concurrency read/write operations without table locking issues.

#### Scenario: High-frequency concurrent writes
- **GIVEN** a Copy Trading simulation is writing 10+ records/second
- **AND** the API is querying pending trades simultaneously
- **WHEN** multiple processes access the database
- **THEN** no "Operation timed out" or "Database locked" errors SHALL occur
- **AND** API response time SHALL remain within acceptable limits (<500ms)

#### Scenario: Production readiness
- **GIVEN** the application is deployed to production
- **WHEN** configured with `DATABASE_URL`
- **THEN** it SHALL connect to a PostgreSQL instance
