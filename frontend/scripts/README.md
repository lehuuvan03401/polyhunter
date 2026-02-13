# Frontend App Scripts

This directory contains app-layer operational scripts for the Next.js service.

## Scope Boundary

- `frontend/scripts/`: API/DB/supervisor operations tied to frontend Prisma and app runtime.
- `scripts/`: SDK/global execution scripts shared across environments.

## Primary Runtime Script

```bash
cd frontend
npx tsx scripts/copy-trading-supervisor.ts
```

This is the supervisor process used for high-scale fanout, dedup, and queue orchestration.

## Script Groups

```text
frontend/scripts/
├── verify/                    # Supervisor load/queue/dedup verification
├── services/                  # Supervisor service adapters
├── copy-trading-supervisor.ts # Main supervisor runtime
├── seed-*.ts                  # Seed and fixture helpers
├── verify-*.ts                # Operational checks
├── adjust-*.ts                # Data correction scripts
└── cleanup-*.ts               # Cleanup and maintenance scripts
```

## Execution Notes

- Run these scripts from `frontend/` unless the script header explicitly says otherwise.
- Ensure `frontend/.env.local` is merged with secrets (`npm run env:local` or `npm run env:mainnet`) before running runtime scripts.
- For real-money copy-trading execution checks, still use root verify scripts:
  - `../scripts/verify/copy-trading-readiness.ts`
  - `../scripts/copy-trading-worker.ts`
