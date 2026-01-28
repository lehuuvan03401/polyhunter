# Change: Add Execution Monitoring and Alerts

## Why
Real-time execution needs visibility into failure rates, latency, and balance safety. Without monitoring, issues can go unnoticed until losses occur.

## What Changes
- Add periodic execution metrics logging (success rate, latency, failure reasons).
- Add balance threshold warnings for worker and proxy.
- Provide hooks for alerting (log-only to start).

## Impact
- Affected specs: `copy-execution`
- Affected code: worker execution flow, monitoring utilities.
