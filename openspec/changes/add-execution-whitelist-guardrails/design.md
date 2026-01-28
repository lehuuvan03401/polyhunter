## Context
Current guardrails include a global enable flag and daily caps, but they do not restrict execution to a specific set of wallets or cap single-trade size.

## Goals / Non-Goals
- Goals:
  - Allowlist specific wallet addresses for execution.
  - Block any trade whose notional exceeds a per-trade cap.
- Non-Goals:
  - UI changes or approval flows.

## Decisions
- Decision: Introduce `COPY_TRADING_EXECUTION_ALLOWLIST` (comma-separated) and `COPY_TRADING_MAX_TRADE_USD`.
- Decision: Guardrails apply in worker preflight and server execution route.

## Risks / Trade-offs
- Misconfigured allowlist can block all execution; mitigated by clear logs/errors.

## Migration Plan
No schema changes required.
