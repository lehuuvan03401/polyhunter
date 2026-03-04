## ADDED Requirements

### Requirement: Fail-Closed Wallet Authentication for Copy-Trading APIs
The system SHALL enforce wallet signature verification for wallet-scoped copy-trading API operations in production, and SHALL NOT accept header-only wallet identity as sufficient authentication.

#### Scenario: Unsigned execute request is rejected in production
- **GIVEN** the environment is production
- **WHEN** a client calls a wallet-scoped copy-trading route without a valid wallet signature
- **THEN** the request is rejected with an authentication error
- **AND** no trade state is mutated

#### Scenario: Signature bypass is limited to non-production test mode
- **GIVEN** an end-to-end test environment with explicit mock-auth override
- **WHEN** a wallet-scoped copy-trading request is submitted without signature
- **THEN** the request may proceed only in non-production mode
- **AND** the same request is rejected when production mode is enabled

### Requirement: Protected Detection and Simulation Mutation Endpoints
The system SHALL require explicit authentication for detection triggers and SHALL restrict simulation redemption writes to authorized simulation contexts only.

#### Scenario: Detection trigger requires valid bearer secret
- **GIVEN** `/api/copy-trading/detect` is invoked
- **WHEN** the `Authorization` bearer token is missing or invalid
- **THEN** the request is rejected as unauthorized
- **AND** no detection loop is executed

#### Scenario: Simulation redemption is blocked outside allowed mode
- **GIVEN** `/api/copy-trading/redeem-sim` receives a write request
- **WHEN** simulation mode is disabled or caller ownership/authentication is invalid
- **THEN** the request is rejected
- **AND** no `CopyTrade` or `UserPosition` mutation occurs

### Requirement: Fail-Closed Secret and Encryption Configuration
The system SHALL fail startup when critical copy-trading secrets are missing, invalid, or placeholder values.

#### Scenario: Missing or default cron secret fails startup
- **GIVEN** `CRON_SECRET` is unset or set to a known insecure default
- **WHEN** copy-trading API services initialize
- **THEN** initialization fails with a configuration error
- **AND** privileged endpoints do not start in fail-open mode

#### Scenario: Invalid encryption key fails startup
- **GIVEN** `ENCRYPTION_KEY` is missing, all-zero placeholder, or invalid length/format
- **WHEN** services requiring key decryption initialize
- **THEN** startup fails with a validation error
- **AND** encrypted credential paths are not executed

### Requirement: Atomic Pending Trade Claim Before Execution
The execute flow SHALL atomically claim a `PENDING` copy trade before any execution side effects occur.

#### Scenario: Concurrent execute requests race on the same trade
- **GIVEN** two or more execute requests target the same `PENDING` trade
- **WHEN** requests are processed concurrently
- **THEN** exactly one request claims the trade for execution
- **AND** all other requests are rejected as already claimed/not pending

#### Scenario: Non-pending trade cannot be re-claimed
- **GIVEN** a trade is already `PROCESSING`, `EXECUTED`, `FAILED`, `SKIPPED`, or `SETTLEMENT_PENDING`
- **WHEN** execute is requested again
- **THEN** claim fails without triggering duplicate execution

### Requirement: Stable Detection Idempotency Identity
Detection pipelines SHALL persist and use stable source identity (`originalTxHash`) for deduplication across signal channels.

#### Scenario: Same leader trade from two channels creates one copy trade
- **GIVEN** WebSocket and polling detect the same leader transaction
- **WHEN** both ingestion paths attempt insert for the same config
- **THEN** at most one `CopyTrade` row is created for that `(configId, originalTxHash)` pair
- **AND** duplicate inserts are treated as idempotent no-ops

#### Scenario: Missing source hash uses deterministic fallback identity
- **GIVEN** source payload lacks a transaction hash
- **WHEN** detector computes fallback identity
- **THEN** identity is deterministic for that source event payload
- **AND** repeated ingestion resolves to the same dedup key

### Requirement: Bounded Query Cost for Copy-Trading Read APIs
Copy-trading read endpoints SHALL enforce hard pagination limits and bounded query plans.

#### Scenario: Oversized client limit is clamped
- **GIVEN** a client requests `limit` above configured maximum
- **WHEN** the request is processed
- **THEN** the API clamps or rejects the limit to a safe maximum
- **AND** response metadata exposes effective pagination values

#### Scenario: Default request uses bounded page size
- **GIVEN** a client omits pagination parameters
- **WHEN** high-cardinality trade/position history is queried
- **THEN** the API returns only the default bounded page size
- **AND** provides cursor/offset metadata for subsequent pages

### Requirement: Bounded In-Memory Cache Lifecycle
In-memory TTL caches used by copy-trading services SHALL enforce maximum entry bounds and periodic stale-entry cleanup.

#### Scenario: Cache respects max entries under key explosion
- **GIVEN** high-cardinality requests create many distinct cache keys
- **WHEN** cache size reaches configured maximum
- **THEN** cache evicts entries according to defined policy
- **AND** process memory growth remains bounded by configuration

#### Scenario: Expired entries are reclaimed without explicit reads
- **GIVEN** many cache entries have expired
- **WHEN** periodic cleanup runs
- **THEN** expired entries are removed
- **AND** stale entries do not accumulate indefinitely

### Requirement: Consistent Environment Contract Across API and Supervisor
Copy-trading API and supervisor components SHALL use a canonical environment variable contract and fail fast on conflicting values.

#### Scenario: Conflicting chain configuration fails startup
- **GIVEN** multiple chain-id environment variables are set with different values
- **WHEN** copy-trading services initialize
- **THEN** startup fails with explicit conflict diagnostics
- **AND** execution does not proceed with ambiguous chain selection

#### Scenario: Dry-run flag semantics are uniform
- **GIVEN** dry-run is enabled through canonical configuration
- **WHEN** API and supervisor process execution requests
- **THEN** both components enforce dry-run consistently
- **AND** no path performs real order execution
