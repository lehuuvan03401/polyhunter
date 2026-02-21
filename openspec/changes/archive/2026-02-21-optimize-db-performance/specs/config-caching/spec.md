# Config Caching

## ADDED Requirements

### Requirement: In-Memory Read-Through Cache
The worker **MUST** cache the results of `refreshConfigs` to minimize database hits.

#### Scenario: Periodic Refresh relies on Cache
Given the worker needs to refresh configurations
When `refreshConfigs` is called
Then it must check the in-memory `UnifiedCache` first (TTL: 10 seconds)
And only query the database if the cache is expired or missing
