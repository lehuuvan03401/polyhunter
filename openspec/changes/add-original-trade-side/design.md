## Context
CopyTrade currently stores only one side field (`originalSide`), but the worker writes the copy side into it. For COUNTER mode, this loses the trader's original side.

## Goals / Non-Goals
- Goals:
  - Preserve the leader's original side separately.
  - Maintain existing usage of `originalSide` as the executed side.
- Non-Goals:
  - Change existing analytics logic beyond populating the new field.

## Decisions
- Decision: Add `leaderSide` (string enum-compatible) on CopyTrade to store the leader's side as received.
- Decision: Populate `leaderSide` in worker and detect paths.

## Risks / Trade-offs
- Additional column requires migration.

## Migration Plan
1) Add nullable `leaderSide` column to CopyTrade.
2) Populate on new writes; no backfill for historical data.
