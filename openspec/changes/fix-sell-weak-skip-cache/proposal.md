# Change: Harden SELL skip logic with DB confirmation and live cache updates

## Why
Supervisor currently hard-skips SELL when in-memory position cache misses, while cache refresh is periodic. This can incorrectly drop valid SELL copies during cache staleness windows.

## What Changes
- Replace hard SELL cache skip with weak skip plus DB secondary confirmation.
- Update position cache immediately after successful execution using executed side/shares.
- Refresh cache from DB on SELL confirmation hits.

## Impact
- Affected specs: `copy-trading`
- Affected code: `web/scripts/workers/copy-trading-supervisor.ts`
