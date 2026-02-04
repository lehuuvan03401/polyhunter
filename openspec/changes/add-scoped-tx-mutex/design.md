## Context
Execution currently uses a global mutex to serialize all on-chain actions. This prevents nonce collisions for a single signer, but also blocks parallel execution across different signers in the same process (e.g., worker pools).

## Goals / Non-Goals
- Goals:
  - Preserve per-signer serialization to avoid nonce collisions.
  - Allow parallel execution across different signers.
  - Keep changes localized and low-risk.
- Non-Goals:
  - Implement full nonce-manager or transaction batching.
  - Change order execution semantics.

## Decisions
- Decision: Use a mutex map keyed by signer address, returning a scoped mutex per signer.
- Alternatives considered:
  - Global mutex (current) — safe but slow under multi-signer load.
  - NonceManager with parallelism — higher complexity and risk.

## Risks / Trade-offs
- Additional memory for mutex map; mitigate by simple eviction if needed later.
- Requires reliable signer address resolution to ensure consistent keying.

## Migration Plan
- Update mutex helper and execution service usage.
- Deploy with logging for queue depth to detect contention regressions.

## Open Questions
- Should we evict inactive signer mutexes after a TTL?
