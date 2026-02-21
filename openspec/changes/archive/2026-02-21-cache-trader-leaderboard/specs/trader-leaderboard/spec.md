# trader-leaderboard Delta

## ADDED Requirements

### Requirement: Leaderboard Data Caching
The system SHALL cache computed trader leaderboard data in the database to avoid real-time Polymarket API calls on every page load.

#### Scenario: Cache update via background job
- **WHEN** the background update script runs (scheduled or manual)
- **THEN** the system fetches trader data from Polymarket APIs
- **AND** computes copy scores using the existing scoring algorithm
- **AND** stores the ranked results in the `CachedTraderLeaderboard` table
- **AND** updates the `LeaderboardCacheMeta` table with timestamp and status

#### Scenario: Serving cached data
- **WHEN** a user requests `/api/traders/active`
- **THEN** the system reads pre-computed rankings from the cache table
- **AND** returns the cached data without calling Polymarket APIs
- **AND** includes cache metadata (timestamp, freshness indicator) in the response

#### Scenario: Cache expiry fallback
- **WHEN** the cache is empty OR older than the configured TTL
- **AND** a request is made to `/api/traders/active`
- **THEN** the system falls back to live data fetching
- **AND** logs a warning about stale cache
- **AND** optionally triggers a background cache refresh

---

### Requirement: Cache Freshness Management
The system SHALL track cache update status and provide visibility into data freshness for monitoring and debugging.

#### Scenario: Recording cache update metadata
- **WHEN** a cache update completes successfully
- **THEN** the system records the completion timestamp in `LeaderboardCacheMeta`
- **AND** stores the number of traders cached
- **AND** marks the status as "SUCCESS"

#### Scenario: Recording failed cache update
- **WHEN** a cache update fails due to API errors or timeouts
- **THEN** the system records the failure timestamp
- **AND** logs the error message
- **AND** marks the status as "FAILED"
- **AND** preserves the previous successful cache data

---

### Requirement: Background Update Scheduling
The system SHALL provide a standalone script for updating the leaderboard cache that can be scheduled via external job schedulers (cron, systemd, cloud scheduler).

#### Scenario: Manual script execution
- **WHEN** an operator runs `npx tsx scripts/update-leaderboard-cache.ts`
- **THEN** the script connects to the database
- **AND** executes the cache update process
- **AND** logs progress and completion status
- **AND** exits with appropriate status code (0 for success, 1 for failure)

#### Scenario: Scheduled execution
- **WHEN** a cron job triggers the update script at scheduled intervals
- **THEN** the script runs unattended
- **AND** handles errors gracefully without manual intervention
- **AND** logs all activities for monitoring

#### Scenario: Configurable update parameters
- **WHEN** the script is invoked with CLI options
- **THEN** it accepts parameters such as:
  - `--period` (7d, 15d, 30d, 90d) to specify which time period to cache
  - `--limit` to specify number of top traders
  - `--force` to bypass cache checks and force refresh
