## Context
The worker and detect API now normalize trade size based on `tradeSizeMode`. Other pipelines (supervisor, simulation) still compute copy size from raw size, potentially diverging from real execution.

## Goals / Non-Goals
- Goals:
  - Normalize trade size for every pipeline that creates CopyTrade records.
  - Preserve `originalSize` as shares for consistency.
- Non-Goals:
  - Redesign sizing strategies.

## Decisions
- Decision: Add a shared normalization helper used across worker, supervisor, and simulation scripts.
- Decision: Apply normalization before copy sizing everywhere.

## Risks / Trade-offs
- Requires touching multiple scripts; unit tests or verification scripts mitigate regressions.

## Migration Plan
No additional schema changes required (uses existing `tradeSizeMode`).
