# Change: Add supervisor DLQ operations tool and SOP

## Why
After adding queue dead-letter handling, operations still lack a safe workflow to inspect, replay, and purge DLQ entries. Without tooling and SOP, DLQ can only grow and incident recovery becomes manual and error-prone.

## What Changes
- Add a supervisor DLQ operations script with `stats`, `peek`, `replay`, and `purge` actions.
- Support replay filters (`reason`, `source`, `token`) and dry-run mode.
- Add operations SOP for DLQ checks, replay, purge, and escalation.
- Link DLQ SOP from operations index.

## Impact
- Affected specs: `copy-trading`
- Affected code/docs:
  - `web/scripts/verify/supervisor-dlq-ops.ts`
  - `docs/operations/sop-supervisor-dlq.md`
  - `docs/operations/README.md`
