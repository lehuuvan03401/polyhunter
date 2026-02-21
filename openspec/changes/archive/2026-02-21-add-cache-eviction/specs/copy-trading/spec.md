## ADDED Requirements
### Requirement: Bounded Cache Eviction
The worker SHALL bound in-memory caches used for preflight and quote lookups and SHALL evict expired entries to prevent unbounded memory growth.

#### Scenario: Evict expired entries
- **GIVEN** cache entries older than their TTL
- **WHEN** periodic prune runs
- **THEN** expired entries are removed

#### Scenario: Enforce max size
- **GIVEN** cache grows beyond its max size
- **WHEN** eviction runs
- **THEN** oldest entries are removed until within bounds
