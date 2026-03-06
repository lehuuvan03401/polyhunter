## ADDED Requirements

### Requirement: Deferred Reimbursement Durability

When copy-trade execution defers bot reimbursement, the execution flow MUST persist a durable reimbursement obligation before releasing the worker back to the runtime.

#### Scenario: Deferred reimbursement creates a durable ledger entry
- **GIVEN** a BUY trade uses bot float and reimbursement is intentionally deferred
- **WHEN** execution finishes without immediate reimbursement
- **THEN** the system persists a reimbursement ledger entry linked to the copy trade
- **AND** the obligation survives process restart

#### Scenario: Deferred reimbursement retries until terminal outcome
- **GIVEN** a pending reimbursement ledger entry exists for a proxy and bot pair
- **WHEN** the authority runtime processes reimbursement recovery
- **THEN** it retries settlement using the configured backoff policy
- **AND** it marks the ledger entry as settled or failed with retry metadata
