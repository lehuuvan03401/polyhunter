# Verification: add-contract-execution-guards

## Local/Fork
1. Deploy contracts (local/fork):
   - `cd contracts && npx hardhat run scripts/deploy.ts --network localhost`
2. Verify allowlists + binding:
   - `npx tsx scripts/verify-local-fork.ts`
   - Confirm logs show executor allowlist configured and execution passes allowlist checks.
3. Contract test suite:
   - `cd contracts && npm run test -- ProxySystem.test.ts`
   - Ensure new allowlist/pause/executor binding tests pass.

## Mainnet Readiness (dry-run)
1. Ensure env addresses are set (factory/executor/usdc/ctf).
2. Run readiness script:
   - `npx tsx scripts/verify/copy-trading-readiness.ts`
3. Confirm no failures for:
   - `EXECUTOR_ALLOWLIST_USDC`, `EXECUTOR_ALLOWLIST_CTF`
   - `PROXY_ALLOWLIST_USDC`, `PROXY_ALLOWLIST_CTF`, `PROXY_PAUSED`
