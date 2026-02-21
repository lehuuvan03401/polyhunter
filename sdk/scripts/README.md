# Horus Root Scripts

This directory contains SDK-level and execution-level scripts run from repository root.

## Scope Boundary

- `scripts/`: shared SDK operations, execution worker, verification flows, and research tooling.
- `web/scripts/`: app-layer jobs (DB backfill, supervisor, frontend-specific operational scripts).

If a script touches copy-trading execution service directly, prefer the root `scripts/` version first.

## Canonical Entrypoints

```bash
# Real-time copy trading worker (primary runtime worker)
npx tsx scripts/copy-trading-worker.ts

# Mainnet readiness check (non-interactive guard check)
npx tsx scripts/verify/copy-trading-readiness.ts

# Full verify catalog
cat scripts/verify/README.md

# Full API verification
npx tsx scripts/verify/verify-all-apis.ts
```

## Directory Layout

```text
scripts/
├── approvals/         # ERC20/ERC1155 approval scripts
├── api-verification/  # External API verification scripts
├── arb/               # Arbitrage runtime tools
├── arb-tests/         # Arbitrage unit/integration/e2e
├── deposit/           # Deposit and bridge operations
├── research/          # Market research tooling
├── smart-money/       # Smart money experiments
├── trading/           # Trading sanity checks
├── verify/            # Copy-trading and runtime verification flows
├── wallet/            # Wallet diagnostics
└── copy-trading-worker.ts
```

## Common Environment Keys

- `TRADING_PRIVATE_KEY`
- `CHAIN_ID`
- `COPY_TRADING_RPC_URL` or `COPY_TRADING_RPC_URLS`
- `DATABASE_URL`
- `ENABLE_REAL_TRADING`
- `COPY_TRADING_DRY_RUN`
- `POLY_API_KEY` / `POLY_API_SECRET` / `POLY_API_PASSPHRASE`

## Quick Commands

```bash
# Verify copy-trading EOA/Proxy execution paths
npx tsx scripts/verify/copy-trading-execution-paths.ts

# Verify async settlement flow
npx tsx scripts/verify/async-settlement-flow.ts

# Verify batched reimbursement ledger flow
npx tsx scripts/verify/reimbursement-ledger-flow.ts
```
