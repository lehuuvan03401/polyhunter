## ADDED Requirements

### Requirement: EOA Execution Service Cache Must Expire
The supervisor SHALL enforce a bounded in-memory lifetime for cached EOA execution services.

#### Scenario: Reuse within TTL
- **GIVEN** an EOA execution service is cached for a config
- **AND** the cache entry is within configured TTL
- **WHEN** the same config requests execution
- **THEN** supervisor reuses the cached service
- **AND** refreshes that entry's last-access timestamp

#### Scenario: Entry expires after inactivity
- **GIVEN** an EOA execution service cache entry is idle beyond configured TTL
- **WHEN** sweep or lookup occurs
- **THEN** supervisor evicts the stale entry
- **AND** subsequent execution creates a fresh service instance

#### Scenario: Shutdown clears cache
- **GIVEN** supervisor is shutting down gracefully
- **WHEN** shutdown sequence runs
- **THEN** supervisor clears cached EOA execution services before process exit
