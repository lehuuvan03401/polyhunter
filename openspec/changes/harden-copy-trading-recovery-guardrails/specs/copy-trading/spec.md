## ADDED Requirements

### Requirement: Authority Runtime Pending Expiration

The authority runtime SHALL expire stale `PENDING` copy trades that are not completed before their confirmation deadline.

#### Scenario: Expire stale pending copy trade
- **GIVEN** a copy trade was prewritten as `PENDING` with an expiration deadline
- **WHEN** the authority runtime finds the trade after the deadline without successful execution
- **THEN** it marks the trade as failed or expired
- **AND** releases any runtime locks associated with the trade

### Requirement: Authority Runtime Market Resolution Ownership

The authority runtime SHALL own market-resolution follow-up for copied positions.

#### Scenario: Resolve winning copied positions
- **GIVEN** copied positions remain open when a market resolves
- **WHEN** the authority runtime confirms the winning outcome
- **THEN** it performs redemption or settlement follow-up for the affected proxy positions
- **AND** records the resulting copy-trade/accounting state without relying on a separate legacy worker

#### Scenario: Resolve losing copied positions
- **GIVEN** copied positions remain open when a market resolves worthless
- **WHEN** the authority runtime processes the loss outcome
- **THEN** it closes the affected position state consistently
- **AND** records the resulting realized outcome in the authority-owned ledger flow

### Requirement: Reservation-Safe Guardrail Enforcement

The authority runtime SHALL enforce global, wallet, market, and rate guardrails using a reservation-safe model under concurrent dispatch.

#### Scenario: Concurrent trades cannot oversubscribe a wallet cap
- **GIVEN** two copy-trade jobs for the same wallet race against a nearly exhausted wallet cap
- **WHEN** both jobs reach guardrail enforcement concurrently
- **THEN** the system reserves capacity before execution dispatch
- **AND** at most one job is allowed if the combined amount would exceed the configured cap

#### Scenario: Released reservation after failed execution
- **GIVEN** a job reserved guardrail capacity
- **WHEN** the job is skipped, fails, or is dropped before execution completes
- **THEN** the runtime releases the reservation
- **AND** later trades can consume the freed capacity
