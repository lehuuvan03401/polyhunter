## ADDED Requirements
### Requirement: Reimbursement Ledger Accumulation
When bot float is used for a proxy, the system SHALL record a reimbursement ledger entry and defer the reimbursement transfer when ledger batching is enabled.

#### Scenario: Ledger entry created on float usage
- **GIVEN** a BUY uses bot float for proxy P
- **WHEN** ledger batching is enabled
- **THEN** a ledger entry is recorded with proxy P, bot B, amount, and status `PENDING`
- **AND** the reimbursement transfer is deferred

### Requirement: Ledger Flush Thresholds
The system SHALL flush reimbursements in a batch when the outstanding ledger amount for a proxy exceeds a configured threshold or the oldest entry exceeds a max age.

#### Scenario: Threshold-based flush
- **GIVEN** proxy P has outstanding ledger amount above the flush threshold
- **WHEN** the ledger flush loop runs
- **THEN** the system executes a single reimbursement transfer for the net amount
- **AND** marks the ledger entries as `SETTLED` on success

### Requirement: Outstanding Float Cap
The system SHALL block further float usage for a proxy when outstanding ledger amount exceeds a configured cap.

#### Scenario: Float disabled when cap exceeded
- **GIVEN** proxy P has outstanding ledger amount above the cap
- **WHEN** a new BUY would use bot float
- **THEN** the system skips float usage and falls back to the proxy-funded path
