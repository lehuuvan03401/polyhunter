## Context
The worker currently listens to all trading activity via WebSocket and filters locally. This can increase bandwidth and processing overhead.

## Goals / Non-Goals
- Goals:
  - Subscribe only to watched trader addresses when supported.
  - Fall back to full subscription when filters are not supported.
- Non-Goals:
  - Changes to detection logic or filtering rules.

## Decisions
- Decision: Detect SDK support for address filters by checking for a `subscribeActivity`/filtered method; use it when available.
- Decision: Log the chosen subscription strategy for observability.

## Risks / Trade-offs
- If the filtered subscription is buggy or incomplete, we may miss trades. We mitigate by falling back to full subscription when filters are unavailable.

## Migration Plan
No schema changes required.
