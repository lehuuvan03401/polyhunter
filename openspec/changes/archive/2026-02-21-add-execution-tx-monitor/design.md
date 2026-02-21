## Context
A TxMonitor utility exists but is not wired into the execution service. Stuck transfers can block fund return and settlement.

## Goals / Non-Goals
- Goals:
  - Track and replace stuck on-chain transactions for execution flows.
  - Keep implementation localized and safe.
- Non-Goals:
  - Introduce a full nonce manager or batcher.

## Decisions
- Decision: Attach TxMonitor to execution service, track tx hash/nonce/gas, and replace with higher priority fee on stuck threshold.
- Alternatives considered:
  - Manual operator intervention only.

## Risks / Trade-offs
- Replacement must preserve nonce; incorrect resubmission could fail if tx already confirmed.

## Migration Plan
- Wire monitor, deploy, observe logs for replacements.

## Open Questions
- Should gas bump update both maxFeePerGas and maxPriorityFeePerGas?
