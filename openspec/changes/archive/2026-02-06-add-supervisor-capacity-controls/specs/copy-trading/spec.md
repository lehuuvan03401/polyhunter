## ADDED Requirements

### Requirement: Configurable Supervisor Worker Pool
The Supervisor SHALL allow configuring the worker pool size via environment variable `SUPERVISOR_WORKER_POOL_SIZE`, defaulting to 20 when unset.

#### Scenario: Override worker pool size
- **GIVEN** `SUPERVISOR_WORKER_POOL_SIZE=50`
- **WHEN** the Supervisor starts
- **THEN** it initializes a worker pool of size 50
- **AND** logs the configured pool size

### Requirement: Incremental Config Refresh
The Supervisor SHALL refresh active copy-trading configurations incrementally using `updatedAt` cursors and avoid full-table scans on every refresh interval.

#### Scenario: New config becomes active
- **GIVEN** a new config is inserted with `updatedAt` later than the last refresh cursor
- **WHEN** the refresh interval elapses
- **THEN** the Supervisor fetches only the delta
- **AND** the new config is added to the active cache

### Requirement: Periodic Full Reconciliation
The Supervisor SHALL perform a periodic full refresh to reconcile deletions or deactivated configs.

#### Scenario: Config is disabled
- **GIVEN** a config was active but is later disabled
- **WHEN** the full reconciliation interval elapses
- **THEN** the config is removed from the active cache
- **AND** the trader is removed from monitored sets if no other configs remain

### Requirement: Config Refresh Metrics
The Supervisor SHALL emit metrics for config refresh size, duration, and last refresh timestamp.

#### Scenario: Refresh metrics logged
- **GIVEN** a refresh cycle completes
- **WHEN** metrics are logged
- **THEN** logs include cache size, refresh duration, and timestamp
