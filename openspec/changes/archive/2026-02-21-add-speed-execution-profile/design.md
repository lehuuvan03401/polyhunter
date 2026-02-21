## Context
Speed mode aims to minimize latency and maximize execution reliability during real‑time copy trading. Current execution only checks price/slippage; it does not enforce spread/depth guardrails or provide a centralized speed configuration.

## Goals / Non-Goals
- Goals:
  - Provide a single speed profile configuration file plus env overrides.
  - Add spread/depth guardrails before execution.
  - Provide a one‑click startup command for speed mode.
- Non-Goals:
  - Replacing the execution engine or adding new external dependencies.

## Decisions
- Use a JSON/TS config file in `web/config/` with safe defaults.
- Use orderbook best bid/ask to compute spread and available depth.
- Skip trades that exceed guardrail thresholds, logging the reason.

## Risks / Trade-offs
- Guardrails may skip valid trades in thin markets; defaults will be conservative and configurable.

## Migration Plan
- Add config + guardrails in execution paths.
- Document env overrides and add speed mode command.

## Open Questions
- Should guardrail violations be persisted to DB for later analysis?
