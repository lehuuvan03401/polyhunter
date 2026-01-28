# Change: Normalize Copy Trade Sizing Across Pipelines

## Why
We added `tradeSizeMode` handling to the worker and detect API, but other pipelines (supervisor/simulators/scripts) may still assume `trade.size` is always shares. This causes inconsistent sizing between real, simulated, and supervised execution.

## What Changes
- Apply trade size normalization (SHARES vs NOTIONAL) consistently across all copy-trading pipelines.
- Ensure `originalSize` is stored as shares in all paths.
- Use normalized notional as the base for copy size calculations everywhere.

## Impact
- Affected specs: `copy-trading`
- Affected code: supervisor, simulation scripts, worker/detect helpers.
