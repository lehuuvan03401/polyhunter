# storage (Delta)

## ADDED Requirements

### Requirement: Hot-Path Index Coverage
The system SHALL maintain composite indexes to support time-window scans for CopyTrade and CommissionLog hot paths.

#### Scenario: Expiring stale PENDING trades
- **GIVEN** the worker scans for `PENDING` trades past `expiresAt`
- **WHEN** the query is executed
- **THEN** the database uses a composite index on `(status, expiresAt)`
- **AND** the scan avoids full table reads under load

#### Scenario: Scheduling retries for FAILED trades
- **GIVEN** the worker scans for `FAILED` trades eligible for retry by `nextRetryAt`
- **WHEN** the query runs
- **THEN** the database uses a composite index on `(status, nextRetryAt)`
- **AND** the worker retrieves the next batch without full table scans

#### Scenario: Aggregating executed totals
- **GIVEN** guardrail logic aggregates totals by `executedAt`
- **WHEN** the query filters by execution time window
- **THEN** the database uses a composite index on `(status, executedAt)`
- **AND** the aggregate query completes within acceptable latency

### Requirement: Post-Archive Maintenance
The system SHALL perform post-archive maintenance to keep planner statistics fresh after bulk deletes.

#### Scenario: CopyTrade archiving completes
- **GIVEN** a batch archive move/delete completes
- **WHEN** maintenance runs
- **THEN** `VACUUM (ANALYZE)` (or equivalent) is executed on affected tables
- **AND** subsequent queries do not regress in latency
