## MODIFIED Requirements
### Requirement: Fixed Global Partner Seat Cap
The system SHALL enforce an immutable hard cap of 100 global partner seats. Runtime/admin configuration MUST NOT raise this cap above 100.

#### Scenario: Admin attempts to raise cap above 100
- **GIVEN** partner program config exists
- **WHEN** admin submits `maxSeats > 100`
- **THEN** the request is rejected with validation error
- **AND** persisted cap remains 100

#### Scenario: Seat allocation at hard cap
- **GIVEN** active seats are exactly 100
- **WHEN** another applicant attempts seat purchase
- **THEN** allocation is rejected with reason `SEAT_CAP_REACHED`

## ADDED Requirements
### Requirement: Automated Month-End Elimination Trigger
The system SHALL provide an automated month-end elimination trigger that executes at most once per `monthKey`.

#### Scenario: Scheduler triggers elimination for current month
- **GIVEN** month-end scheduler is running
- **WHEN** elimination job executes for `monthKey`
- **THEN** bottom-ranked seats are processed using the configured elimination count
- **AND** cycle idempotency prevents duplicate execution for the same `monthKey`

### Requirement: Refund SLA Watchdog
The system SHALL monitor pending refunds and flag/alert overdue refunds past the 7-day deadline.

#### Scenario: Pending refund exceeds deadline
- **GIVEN** a partner refund remains `PENDING`
- **AND** current time is after `refundDeadlineAt`
- **WHEN** SLA watchdog checks refund queue
- **THEN** an overdue alert event is emitted for operations follow-up
