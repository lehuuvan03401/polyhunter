## Context
Copy trading uses a bot float strategy to accelerate execution, then reimburses the bot from the proxy. Even with async settlement, reimbursements remain per-trade and create high on-chain load. We need a safe way to batch reimbursements without increasing exposure beyond acceptable limits.

## Goals / Non-Goals
- Goals:
  - Reduce on-chain reimbursement TX count via batching/netting.
  - Keep user funds safe and prevent uncontrolled bot exposure.
  - Provide clear observability and recovery for failed batch reimbursements.
- Non-Goals:
  - Changing order placement flow or CLOB interaction.
  - Delaying token push to proxies (user positions should remain correct).

## Decisions
- Decision: Introduce a `ReimbursementLedger` to accumulate outstanding reimbursements per proxy/bot.
  - Rationale: Enables netting across multiple trades and reduces transfer frequency.
- Decision: Flush reimbursements on configurable thresholds (amount and max age).
  - Rationale: Keeps backlog bounded and allows tuning for throughput vs. exposure.
- Decision: Enforce an outstanding-float cap per proxy and disable float when exceeded.
  - Rationale: Limits risk if reimbursements are delayed or fail.

## Risks / Trade-offs
- Deferred reimbursements temporarily increase bot exposure.
  - Mitigation: cap outstanding balance; alert on backlog age.
- Batch reimbursement failures may block multiple trades from settling.
  - Mitigation: retry with backoff, alert on repeated failures, fall back to immediate reimbursement when needed.

## Migration Plan
- Add feature flag (e.g., `COPY_TRADING_LEDGER_ENABLED`).
- Roll out in dry-run and local fork first.
- Enable for a small subset of proxies, monitor backlog/flush success.
- Gradually increase coverage once stable.

## Open Questions
- What default thresholds for flush amount and max age are acceptable on Polygon?
- Should we net across BUY/SELL flows or only float reimbursements?
- Do we need per-user overrides or global limits only?
