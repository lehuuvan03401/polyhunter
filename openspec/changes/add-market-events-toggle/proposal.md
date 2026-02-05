# Change: Toggle market lifecycle WS subscription in copy-trading worker

## Why
Market lifecycle subscriptions can emit unsupported CLOB errors in local or limited environments, cluttering logs and blocking clean verification runs.

## What Changes
- Add an environment flag to disable market lifecycle (clob_market) subscriptions in the copy-trading worker.
- Log whether market events are enabled or skipped at startup.

## Impact
- Affected specs: copy-trading
- Affected code: scripts/copy-trading-worker.ts
