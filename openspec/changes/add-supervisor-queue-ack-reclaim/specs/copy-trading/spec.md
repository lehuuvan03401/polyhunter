## ADDED Requirements

### Requirement: Supervisor Queue Consumption MUST Support Acknowledgement
The supervisor SHALL claim queue jobs with explicit acknowledgement semantics so jobs are not lost on consumer crashes.

#### Scenario: Claimed job is acknowledged after execution path completes
- **GIVEN** a queued copy-trade job is claimed by a worker
- **WHEN** execution handling finishes for that claimed job
- **THEN** supervisor acknowledges the claim and removes it from processing state

#### Scenario: Unacked stale claim is reclaimed
- **GIVEN** a claimed queue job remains unacknowledged beyond lease TTL
- **WHEN** queue reclaim loop runs
- **THEN** supervisor moves the stale claim back to pending queue for retry
- **AND** records reclaim activity in queue metrics
