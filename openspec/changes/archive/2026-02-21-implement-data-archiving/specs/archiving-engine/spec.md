# Archiving Engine

## ADDED Requirements

### Requirement: Scheduled Data Archiving
The system **MUST** provide a mechanism to move historical `CopyTrade` and `CommissionLog` records to separation archive tables.

#### Scenario: Archiving Old Trades
Given the database contains `CopyTrade` records older than 90 days
AND the records have a final status (EXECUTED, SKIPPED, FAILED)
When the archiving script is executed
Then these records must be copied to `CopyTradeArchive`
And subsequently deleted from `CopyTrade` in a transactional manner
And the process must be performed in batches (e.g., 1000 records) to avoid table locking

#### Scenario: Archiving Commission Logs
Given the database contains `CommissionLog` records older than 90 days
When the archiving script is executed
Then these records must be copied to `CommissionLogArchive`
And deleted from `CommissionLog`

### Requirement: Data Integrity
Archived records **MUST** retain their original IDs and essential metadata.

#### Scenario: Idempotency
Given a record has already been archived
When the script runs again
Then it must not create duplicate entries in the archive table (enforced by PK)
