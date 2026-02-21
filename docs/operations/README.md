# Operations Index

Operational entrypoint for deployment, verification, and runbook workflows.

## Start Here

1. Real-trading end-to-end runbook:
   - `docs/operations/runbook.md`
2. Production deployment guide:
   - `docs/operations/production_deployment.md`
3. Supervisor scaling deployment:
   - `docs/operations/deploy-supervisor-capacity-controls.md`
   - `docs/operations/sop-supervisor-capacity-controls.md`

## Copy-Trading Verification

- Readiness: `scripts/verify/copy-trading-readiness.ts`
- Execution path verification: `scripts/verify/copy-trading-execution-paths.ts`
- Async settlement: `scripts/verify/async-settlement-flow.ts`
- Reimbursement ledger: `scripts/verify/reimbursement-ledger-flow.ts`
- Lock claim flow: `docs/operations/copy-trade-lock-claim-verification.md`

## Runtime Scripts

- Worker (root): `scripts/copy-trading-worker.ts`
- Supervisor (frontend): `web/scripts/copy-trading-supervisor.ts`

## Safety Checklist

Before real-money tests:
- Confirm `ENABLE_REAL_TRADING=true`
- Confirm explicit `COPY_TRADING_DRY_RUN` value (`true` or `false`)
- Run readiness and ensure it passes without `NO_PROXY`/allowlist/approval issues
