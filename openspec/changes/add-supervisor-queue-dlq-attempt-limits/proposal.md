# Change: Add supervisor queue dead-letter handling and attempt limits

## Why
Queue claim/ack semantics prevent immediate job loss, but repeated failures can still cause infinite requeue loops and queue pressure. Production needs bounded retries with dead-letter isolation for poison jobs.

## What Changes
- Add configurable max queue delivery attempts.
- Add dead-letter queue (DLQ) for jobs that exceed max attempts or cannot be requeued.
- Add queue reclaim behavior that dead-letters expired claims when attempt limit is reached.
- Add queue DLQ metrics and alert threshold integration.

## Impact
- Affected specs: `copy-trading`
- Affected code:
  - `web/scripts/workers/copy-trading-supervisor.ts`
