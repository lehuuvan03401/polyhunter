## Context
The execution service can process multiple trades in parallel for the same proxy. Overlapping fund pulls/returns and settlement operations risk double-spend or inconsistent balances.

## Goals / Non-Goals
- Goals:
  - Serialize execution per proxy address to avoid overlapping fund operations.
  - Maintain parallelism across different proxies.
- Non-Goals:
  - Replace signer-level mutex.
  - Rework the execution flow beyond scoping the queue.

## Decisions
- Decision: Add a proxy-scoped mutex/queue keyed by proxy address.
- Alternatives considered:
  - Database locks (adds complexity and DB contention).
  - Global mutex (reduces throughput).

## Risks / Trade-offs
- Proxy-level serialization can reduce throughput for extremely active single proxies.

## Migration Plan
- Introduce proxy queue and wrap critical sections in the execution flow.

## Open Questions
- Should the queue cover the entire execution or only fund-transfer + settlement sections?
