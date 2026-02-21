# Async Prewrite

## ADDED Requirements

### Requirement: Non-Blocking Prewrite
The worker **MUST NOT** await the database "create" operation for `CopyTrade` records before proceeding to execution logic.

#### Scenario: Trade Execution is Optimistic
Given a detected opportunity that passes filters
When the worker prepares to execute
Then it must trigger the DB write in the background
And immediately proceed to the execution stage without waiting for the DB ID
And must catch and log any DB write errors to prevent process crash

### Requirement: In-Memory Deduplication
The worker **MUST** rely on in-memory mechanisms to prevent duplicate processing during the async write window.

#### Scenario: Rapid Duplicate Signals
Given a high-frequency trading environment
When multiple signals for the same trade arrive within milliseconds
Then the worker must use `idempotencyKey` checks in memory to reject duplicates
And must not rely solely on unique constraints in the database
