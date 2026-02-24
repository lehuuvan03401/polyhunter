## ADDED Requirements

### Requirement: Supervisor MUST Recover Settlement Pending Trades
The supervisor SHALL periodically recover `SETTLEMENT_PENDING` copy trades to ensure eventual settlement closure.

#### Scenario: Settlement pending trade recovered successfully
- **GIVEN** a copy trade in `SETTLEMENT_PENDING` with valid wallet/proxy/token/price context
- **WHEN** supervisor recovery loop processes the trade
- **THEN** it invokes settlement recovery execution
- **AND** marks the trade as `EXECUTED` when recovery succeeds
- **AND** clears retry scheduling and lock fields

#### Scenario: Recovery failure schedules retry with backoff
- **GIVEN** a copy trade in `SETTLEMENT_PENDING` and recovery execution fails
- **WHEN** retry count is below configured maximum
- **THEN** supervisor keeps status as `SETTLEMENT_PENDING`
- **AND** increments retry count
- **AND** schedules `nextRetryAt` using exponential backoff
- **AND** releases lock fields for future claim

#### Scenario: Retry exhausted marks trade failed
- **GIVEN** a copy trade in `SETTLEMENT_PENDING` and recovery failures reach configured max retries
- **WHEN** supervisor processes the final failed attempt
- **THEN** it marks the trade as `FAILED`
- **AND** stops further retry scheduling for that trade
