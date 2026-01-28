## Context
Execution currently verifies balances and (in some paths) approvals inside the TradingService, but proxy allowances for on-chain transfers are not prechecked. Missing allowances lead to execution failure and wasted latency.

## Goals / Non-Goals
- Goals:
  - Preflight check for proxy USDC allowance (BUY) and CTF approval (SELL).
  - Provide actionable error/skip reasons when allowance is missing.
- Non-Goals:
  - Automatic allowance transactions on behalf of users.
  - Changes to UI flows beyond returning clear error messages.

## Decisions
- Decision: Implement allowance checks in worker preflight and server execution routes.
- Decision: Use read-only allowance calls (ERC20 allowance, CTF isApprovedForAll) against proxy owner.

## Risks / Trade-offs
- Slight additional RPC calls; mitigated by short-lived in-memory caching if needed later.

## Migration Plan
No schema changes required.
