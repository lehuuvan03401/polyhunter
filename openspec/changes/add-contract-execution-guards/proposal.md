# Change: Add on-chain execution guardrails for proxy trading

## Why
Real-funds proxy execution currently relies on off-chain guardrails and a broad on-chain execute surface. Tightening on-chain controls reduces blast radius from misconfiguration, worker compromise, or address drift.

## What Changes
- Add on-chain emergency pause for Proxy and Executor to block execute paths.
- Add on-chain target allowlist for Proxy.execute and Executor.executeOnProxy; default allowlist includes USDC.e and CTF exchange; factory-managed updates and batch migration for existing proxies.
- Bind each Proxy to a designated Executor on creation and restrict execution to bound Executor + owner (no additional operators).
- Unify contract address resolution in SDK/runtime and validate required addresses on startup.
- **BREAKING:** Proxy execution will revert for non-allowlisted targets.

## Impact
- Affected specs: copy-execution
- Affected code: contracts (Proxy/Factory/Executor), deployment scripts, SDK ABIs/constants, copy-trading execution service, docs/tests
