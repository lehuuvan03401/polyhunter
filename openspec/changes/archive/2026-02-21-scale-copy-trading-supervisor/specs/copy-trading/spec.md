# copy-trading Spec Delta (Scale Copy Trading Supervisor)

## ADDED Requirements

### Requirement: Address-Filtered Activity Subscription
The Supervisor **MUST** subscribe to activity streams using monitored trader filters when supported by the realtime provider.

#### Scenario: Filtered subscription reduces noise
- **GIVEN** a set of monitored traders is loaded
- **WHEN** the Supervisor connects to the activity stream
- **THEN** it subscribes using an address filter
- **AND** falls back to all-activity only if the provider does not support filters

### Requirement: Bounded Subscriber Fan-out
The Supervisor **MUST** process subscriber fan-out with bounded concurrency to prevent serial backlogs.

#### Scenario: Many subscribers for one trader
- **GIVEN** a trader with 500 subscribers
- **WHEN** a trade signal arrives
- **THEN** the Supervisor dispatches jobs with a configurable concurrency limit
- **AND** does not block processing other traders

### Requirement: Durable Execution Queue
When workers are saturated, the Supervisor **MUST** enqueue copy jobs in a durable queue and apply backpressure when full.

#### Scenario: Queue saturation
- **GIVEN** all workers are busy and the queue is at capacity
- **WHEN** a new job arrives
- **THEN** the Supervisor records a drop metric
- **AND** does not enqueue beyond capacity

### Requirement: Shared Deduplication Store
Deduplication **MUST** be enforced across all supervisor instances using a shared store.

#### Scenario: Multi-instance duplicate prevention
- **GIVEN** two supervisor instances receive the same event
- **WHEN** the first instance records the dedup key
- **THEN** the second instance skips processing within TTL

### Requirement: Market Metadata Cache
The Supervisor **MUST** cache market metadata and refresh it periodically to avoid per-trade lookups.

#### Scenario: Metadata cache hit
- **GIVEN** metadata for token X was cached within TTL
- **WHEN** another trade for token X arrives
- **THEN** the cached metadata is used without a new API call

### Requirement: Guardrail Counters Cache
Guardrail checks **MUST** use cached counters (global/wallet/market/window) with bounded staleness.

#### Scenario: Guardrail check at scale
- **GIVEN** a high-frequency trading period
- **WHEN** a guardrail check is executed
- **THEN** the check uses cached counters
- **AND** avoids full-table aggregation queries per trade

### Requirement: Sharded Ownership
Supervisor instances **MUST** use a deterministic shard key to avoid duplicate processing across instances.

#### Scenario: Sharded trade processing
- **GIVEN** two supervisor instances are running
- **WHEN** a trader’s event arrives
- **THEN** only the instance responsible for that trader’s shard processes the event

## MODIFIED Requirements

### Requirement: Event Deduplication
The system SHALL track processed events using a shared dedup key. The key **MUST** include `txHash + logIndex` when available.

#### Scenario: Duplicate event within TTL
- **GIVEN** event with txHash "0xABC123" and logIndex "7" was processed 30 seconds ago
- **WHEN** the same event is received again
- **THEN** the system skips processing using the shared dedup key
