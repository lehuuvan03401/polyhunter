# Production Env Alignment Checklist

Purpose: align production runtime env with hardened copy-trading + managed/participation policy gates before go-live.

Source baseline reviewed on 2026-03-05:
- `web/.env`
- `web/.env.local`
- `web/.env.production.example`

Bootstrap:

```bash
cd web
cp .env.production.example .env.production
```

## 1) P0 Blockers (must be correct before deploy)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to production DB (not localhost)
- [ ] `CHAIN_ID=137`
- [ ] `NEXT_PUBLIC_CHAIN_ID=137`
- [ ] `NEXT_PUBLIC_NETWORK=polygon`
- [ ] `NEXT_PUBLIC_RPC_URL` points to production RPC
- [ ] `NEXT_PUBLIC_PROXY_FACTORY_ADDRESS` matches deployed production address
- [ ] `NEXT_PUBLIC_TREASURY_ADDRESS` matches deployed production address
- [ ] `NEXT_PUBLIC_EXECUTOR_ADDRESS` matches deployed production address
- [ ] `NEXT_PUBLIC_USDC_ADDRESS` is set
- [ ] `NEXT_PUBLIC_CTF_ADDRESS` is set
- [ ] `TREASURY_ADDRESS` is set
- [ ] `TRADING_PRIVATE_KEY` or `TRADING_MNEMONIC` is present (production key only)
- [ ] `POLY_API_KEY`, `POLY_API_SECRET`, `POLY_API_PASSPHRASE` are present
- [ ] `CRON_SECRET` is present and not placeholder (`dev-cron-secret` forbidden)
- [ ] `ENCRYPTION_KEY` is 64-hex and non-zero
- [ ] `COPY_TRADING_DRY_RUN=false` (or `DRY_RUN=false`; do not conflict)
- [ ] `ENABLE_REAL_TRADING=true`
- [ ] `COPY_TRADING_EMERGENCY_PAUSE=false`
- [ ] `SUPERVISOR_REDIS_URL` is configured and reachable

## 2) Policy and Risk Flags (production-intent explicitness)

- [ ] `PARTICIPATION_REQUIRE_MANAGED_ACTIVATION=true`
- [ ] `PARTICIPATION_REQUIRE_CUSTODY_AUTH=true`
- [ ] `COPY_TRADING_DAILY_CAP_USD` is set
- [ ] `COPY_TRADING_WALLET_DAILY_CAP_USD` is set
- [ ] `COPY_TRADING_RPC_URL` is set (dedicated backend RPC recommended)
- [ ] `COPY_TRADING_PRICE_TTL_MS` is set intentionally

Notes:
- In production, managed activation/custody gates are hard-enforced by policy logic even if env is `false`. Keep env explicit to avoid operator confusion.
- `CHAIN_ID` and `NEXT_PUBLIC_CHAIN_ID` must not conflict.

## 3) Local/Simulation Vars That Must Not Ship to Production

- [ ] Remove/disable `FOLLOWER_WALLET`
- [ ] Remove/disable `TARGET_TRADER`
- [ ] Remove/disable `TARGET_FUND_ADDRESS`
- [ ] Remove/disable `SIM_COPY_MODE`
- [ ] Remove/disable `SIM_ACTIVITY_FILTER`
- [ ] Remove/disable `SIM_WS_SERVER_FILTER`
- [ ] Remove/disable `COPY_MODE`
- [ ] Remove/disable `MAX_BUDGET`
- [ ] Remove/disable `MAX_TRADE_SIZE`
- [ ] Remove/disable `EST_LEADER_VOLUME`
- [ ] Remove/disable `SCALE_FACTOR`
- [ ] Remove/disable `FIXED_COPY_AMOUNT`
- [ ] Ensure `NEXT_PUBLIC_E2E_MOCK_AUTH` is not enabled

## 4) Current Drift Snapshot (.env vs .env.local)

`.env` has but `.env.local` currently lacks:
- `PARTICIPATION_REQUIRE_MANAGED_ACTIVATION`
- `PARTICIPATION_REQUIRE_CUSTODY_AUTH`
- managed wealth tuning keys (`MANAGED_*`, `PARTICIPATION_MANAGED_MIN_PRINCIPAL_USD`)
- `POLY_API_KEY`, `POLY_API_SECRET`, `POLY_API_PASSPHRASE` (present as empty placeholders in `.env`)

`.env.local` has but `.env` currently lacks:
- `SUPERVISOR_REDIS_URL`
- simulation/live-debug vars (`FOLLOWER_WALLET`, `TARGET_TRADER`, `COPY_MODE`, etc.)

## 5) Preflight Commands (before traffic open)

```bash
cd web
npx prisma migrate deploy
npx tsc --noEmit -p tsconfig.json
```

```bash
cd sdk
npx tsx scripts/verify/copy-trading-readiness.ts
npx tsx scripts/verify/copy-trading-execution-paths.ts
```

If async settlement / reimbursement ledger is enabled, also run:

```bash
cd sdk
npx tsx scripts/verify/async-settlement-flow.ts
npx tsx scripts/verify/reimbursement-ledger-flow.ts
```
