## ADDED Requirements
### Requirement: Preflight Balance Cache
The system SHALL cache preflight balance and allowance reads with a maximum TTL of 2 seconds and SHALL deduplicate in-flight reads for the same proxy/token. Cached values MUST be used only for preflight checks and MUST NOT replace execution-time reads.

#### Scenario: Cache hit within TTL
- **GIVEN** a proxy balance was fetched at time T
- **WHEN** another preflight check occurs at time T+1s for the same proxy
- **THEN** the cached balance is used without a new RPC call

#### Scenario: Cache miss after TTL
- **GIVEN** a proxy balance was fetched at time T
- **WHEN** another preflight check occurs at time T+3s for the same proxy
- **THEN** the worker fetches a fresh balance from RPC

#### Scenario: In-flight dedupe
- **GIVEN** two preflight checks for the same proxy/token occur concurrently
- **WHEN** the worker requests the balance/allowance
- **THEN** the second check reuses the in-flight promise
- **AND** only one RPC call is executed
