# Frontend App Scripts

This directory contains app-layer operational scripts for the Next.js service.

## Scope Boundary

- `web/scripts/`: API/DB/supervisor operations tied to web Prisma and app runtime.
- `sdk/scripts/`: SDK/global verification scripts shared across environments.

## Primary Runtime Script

```bash
cd web
npx tsx scripts/workers/copy-trading-supervisor.ts
```

This is the supervisor process used for high-scale fanout, dedup, and queue orchestration.

## Script Groups

```text
web/scripts/
├── verify/                    # Supervisor load/queue/dedup verification
├── workers/                   # Long-running runtimes (worker/supervisor)
├── services/                  # Supervisor service adapters
├── env/                       # Environment helpers
├── db/                        # Data correction and backfill scripts
└── simulate/                  # Local simulation helpers
```

## Execution Notes

- Run these scripts from `web/` unless the script header explicitly says otherwise.
- Ensure `web/.env.local` is merged with secrets (`npm run env:local` or `npm run env:mainnet`) before running runtime scripts.
- For real-money copy-trading execution checks, use SDK verify scripts:
  - `../sdk/scripts/verify/copy-trading-readiness.ts`
  - `../sdk/scripts/verify/copy-trading-execution-paths.ts`
