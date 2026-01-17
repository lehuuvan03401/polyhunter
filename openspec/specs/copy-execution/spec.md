# copy-execution Specification

## Purpose
TBD - created by archiving change implement-proxy-debt-tracking. Update Purpose after archive.
## Requirements
### Requirement: Execution Safety
The system MUST protect Worker Bot capital when using optimized execution strategies (Floating).

#### Scenario: Reimbursement Failure Logging
- **WHEN** the Worker Bot successfully buys tokens using its own funds (Float) for a User Proxy
- **AND** the subsequent reimbursement transfer (Proxy -> Bot) fails (e.g., insufficient Proxy balance)
- **THEN** a `DebtRecord` MUST be created in the database with status `PENDING`
- **AND** the incident MUST be logged

#### Scenario: Debt Recovery
- **WHEN** the Debt Recovery process runs
- **AND** a User Proxy with `PENDING` debt has sufficient USDC balance
- **THEN** the system MUST initiate a transfer from Proxy to Bot matching the debt amount
- **AND** update the `DebtRecord` status to `REPAID` upon success
- **AND** the recovered funds MUST be available for future trades

