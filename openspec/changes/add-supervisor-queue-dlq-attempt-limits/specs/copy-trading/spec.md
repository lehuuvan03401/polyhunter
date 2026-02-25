## ADDED Requirements

### Requirement: Supervisor Queue MUST Bound Retry Attempts
The supervisor queue SHALL enforce a maximum delivery attempt limit for each queued job.

#### Scenario: Job retries until maximum attempt
- **GIVEN** a queued job fails to complete and is nacked or reclaimed
- **WHEN** its attempt count remains below configured maximum
- **THEN** the job is requeued for another delivery attempt

#### Scenario: Job exceeds attempt limit and is dead-lettered
- **GIVEN** a queued job reaches or exceeds the configured attempt limit
- **WHEN** supervisor handles nack/reclaim for that job
- **THEN** it is moved to dead-letter storage
- **AND** it is not requeued to the active queue

### Requirement: Supervisor Queue MUST Expose DLQ Observability
The supervisor SHALL expose dead-letter queue behavior through metrics and alerting inputs.

#### Scenario: DLQ metrics are emitted
- **GIVEN** queue processing is running
- **WHEN** metrics endpoint is scraped
- **THEN** queue dead-letter counters and current DLQ size are available for monitoring
