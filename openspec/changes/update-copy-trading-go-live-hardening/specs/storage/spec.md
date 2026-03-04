## ADDED Requirements

### Requirement: Atomic Guardrail Counter Storage
Guardrail counters SHALL use atomic increment semantics across concurrent workers and supervisor shards.

#### Scenario: Concurrent counter increments preserve exact totals
- **GIVEN** multiple workers concurrently increment the same global or wallet guardrail counter
- **WHEN** increments are processed under burst load
- **THEN** no increments are lost or overwritten
- **AND** subsequent guardrail checks observe monotonic, correct totals

#### Scenario: Sharded mode refuses non-atomic counter backends
- **GIVEN** supervisor sharding is enabled
- **WHEN** shared atomic counter storage is unavailable
- **THEN** supervisor startup fails with explicit storage dependency errors
- **AND** the system does not run with non-shared in-memory counters

### Requirement: Persistent Trade Identity and Claim Metadata
Copy-trade storage SHALL persist stable source identity and execution claim metadata to support idempotent ingestion and single-consumer execution.

#### Scenario: Detection writes stable identity for deduplication
- **GIVEN** a detected leader trade has source transaction identity
- **WHEN** detector writes a `CopyTrade` row
- **THEN** source identity is persisted for uniqueness checks
- **AND** repeated ingestion for the same config+identity is idempotently rejected or merged

#### Scenario: Execution claim update is conditional on pending state
- **GIVEN** an execute request attempts to claim a trade
- **WHEN** storage applies the claim mutation
- **THEN** the mutation succeeds only if trade state is currently claimable
- **AND** lock metadata identifies the claim owner and claim timestamp
