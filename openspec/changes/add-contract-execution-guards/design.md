## Context
Proxy-mode execution currently relies on off-chain guardrails and a permissive on-chain execute surface. The Proxy contract is not upgradeable, and address configuration is sourced from multiple files/envs, increasing the risk of misconfiguration in real-funds environments.

## Goals / Non-Goals
- Goals:
  - Enforce on-chain target allowlist for Proxy.execute calls.
  - Provide on-chain emergency pause to block executions quickly.
  - Bind each Proxy to a designated Executor to reduce operator sprawl.
  - Unify and validate contract address resolution at runtime.
- Non-Goals:
  - Upgrade existing proxies in place (not possible with current contracts).
  - Replace off-chain guardrails or rate limits.

## Decisions
- Add `allowedTargets` and `paused` checks to `PolyHunterProxy.execute` and expose factory-controlled allowlist updates.
- Add `allowedTargets` + `paused` controls to `PolyHunterExecutor.executeOnProxy` with owner-only pause/unpause.
- Store an `executor` address in Proxy and allow execution only from `owner` or the bound `executor` (no extra operators).
- ProxyFactory will set the executor and initialize default allowlist entries (USDC.e + CTF exchange) when creating a Proxy.
- Runtime code will fail fast if required addresses (factory/executor/CTF/USDC) are missing for the selected chain.

## Alternatives Considered
- Off-chain-only guardrails: rejected due to single-point failure if worker keys are compromised.
- Owner-managed allowlist: rejected because it allows users to weaken security.

## Risks / Trade-offs
- Requires new contract deployments (Factory/Proxy/Executor); existing proxies remain legacy.
- Misconfigured allowlist could block execution; mitigated by default allowlist + verification scripts.

## Migration Plan
1. Deploy new ProxyFactory/Executor contracts and update `deployed-addresses.json` + env.
2. Update SDK addresses/ABIs and execution service checks.
3. Provide an ops runbook to migrate users (create new proxy, move funds, revoke old operator).
4. Mark old factory as legacy in docs and disable new signups on it.

## Open Questions
- Do we need to keep owner-triggered `execute` or require all executions through the bound Executor?
- Should the Executor allowlist be managed by owner only, or also allow Factory to sync defaults?
