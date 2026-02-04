## Context
The worker currently depends on orderbook quotes for pre-execution price checks. When the orderbook is empty or RPC is flaky, the execution is skipped.

## Goals / Non-Goals
- Goals:
  - Allow a controlled fallback quote when orderbook data is missing.
  - Preserve safety via TTL and slippage checks.
- Non-Goals:
  - Replace orderbook as the primary source.

## Decisions
- Decision: Use orderbook as primary, fallback to Gamma or recent trade price if orderbook unavailable.
- Alternatives considered:
  - Skip execution entirely (current behavior).

## Risks / Trade-offs
- Fallback prices may be less precise; mitigated by strict TTL and slippage caps.

## Migration Plan
- Add fallback in `fetchFreshPrice`, with source tagging.

## Open Questions
- Which fallback source should be preferred: Gamma price or recent trade price?
