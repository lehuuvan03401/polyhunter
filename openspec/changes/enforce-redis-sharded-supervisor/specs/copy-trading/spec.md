## ADDED Requirements

### Requirement: Redis Is Mandatory For Sharded Supervisor Mode
The supervisor SHALL require Redis-backed shared queue, dedup, and counter stores when `SUPERVISOR_SHARD_COUNT>1`.

#### Scenario: Missing Redis URL in sharded mode
- **GIVEN** `SUPERVISOR_SHARD_COUNT` is greater than 1
- **AND** `SUPERVISOR_REDIS_URL` and `REDIS_URL` are unset
- **WHEN** supervisor starts
- **THEN** startup fails fast
- **AND** supervisor does not continue with in-memory shared stores

#### Scenario: Redis unavailable in sharded mode
- **GIVEN** `SUPERVISOR_SHARD_COUNT` is greater than 1
- **AND** Redis URL is configured
- **WHEN** Redis initialization or ping fails
- **THEN** startup fails fast
- **AND** supervisor does not continue with in-memory shared stores

#### Scenario: Single-instance fallback remains available
- **GIVEN** `SUPERVISOR_SHARD_COUNT` is 1
- **AND** Redis is unavailable
- **WHEN** supervisor starts
- **THEN** supervisor may continue with in-memory shared stores
