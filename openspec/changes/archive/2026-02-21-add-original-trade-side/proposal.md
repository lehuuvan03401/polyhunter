# Change: Preserve Original Leader Trade Side

## Why
The copy-trading pipeline overwrites `originalSide` with the copied side (especially in COUNTER mode), losing the leader's true action. This makes auditing and analytics difficult.

## What Changes
- Add a dedicated field to store the leader's original side.
- Keep `originalSide` as the executed/copy side for backward compatibility.
- Update worker/detect paths to persist both values.

## Impact
- Affected specs: `copy-trading`
- Affected code: copy-trading worker, detect route, Prisma schema/migrations.
