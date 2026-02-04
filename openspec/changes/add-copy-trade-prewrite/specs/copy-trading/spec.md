## ADDED Requirements
### Requirement: Execution Record Before Order Submission
The system SHALL persist a CopyTrade record in the database before any real order submission or on-chain transfer is initiated. If the record cannot be persisted, execution MUST NOT proceed.

#### Scenario: Prewrite succeeds before execution
- GIVEN a copy trade signal passes pre-execution checks
- WHEN the worker prepares to execute a real trade
- THEN it creates a CopyTrade record with status PENDING
- AND only after the record is persisted does execution begin

#### Scenario: Duplicate prewrite blocks execution
- GIVEN a copy trade signal with an idempotency key already stored for config X
- WHEN the worker attempts to prewrite the CopyTrade record
- THEN the insert fails due to uniqueness constraints
- AND the execution is skipped and logged as a duplicate

#### Scenario: Prewrite failure blocks execution
- GIVEN a copy trade signal passes pre-execution checks
- WHEN the worker fails to persist the CopyTrade record due to a database error
- THEN the execution is aborted
- AND the error is recorded for later inspection
