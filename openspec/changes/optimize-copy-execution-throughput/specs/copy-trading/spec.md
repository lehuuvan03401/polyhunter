## ADDED Requirements

### Requirement: Narrowed Execution Mutex Scope
The execution engine SHALL restrict signer-level mutexes to on-chain transaction submission steps only.

#### Scenario: Parallel CLOB orders
- **GIVEN** two copy trades for different proxies share the same worker signer
- **WHEN** both trades reach the CLOB order placement step
- **THEN** the system does not block parallel order placement on signer mutex
- **AND** only on-chain transactions are serialized

### Requirement: Async Settlement Queue
The system SHALL enqueue settlement transfers (push/reimburse) for asynchronous processing when enabled.

#### Scenario: Deferred settlement after BUY
- **GIVEN** a BUY trade succeeds
- **WHEN** async settlement is enabled
- **THEN** the token push and reimbursement are enqueued
- **AND** the worker is released without waiting for settlement completion

### Requirement: Settlement Retry and Monitoring
The system SHALL retry failed settlement tasks and log retry outcomes.

#### Scenario: Settlement retry
- **GIVEN** a settlement transfer fails
- **WHEN** the retry policy is applied
- **THEN** the task is retried up to the configured limit
- **AND** failures are logged with reason and attempt count

### Requirement: Settlement Queue Metrics
The system SHALL emit metrics for settlement queue depth, lag, and retry counts.

#### Scenario: Metrics logged
- **GIVEN** settlement tasks are queued
- **WHEN** metrics are emitted
- **THEN** the log includes queue depth and average lag
