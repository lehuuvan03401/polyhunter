# Task Plan: Batched Reimbursement Ledger (add-batched-reimbursement-ledger)

## Goal
Reduce reimbursement TX volume by batching bot float reimbursements while keeping exposure capped and observable.

## Current Phase
Phase 2: Verification (in_progress)

## Phases

### Phase 1: Implementation
- [x] 1.1 Add ReimbursementLedger model + migration
- [x] 1.2 Add ledger controls to execution service (defer reimbursement + float allow flag)
- [x] 1.3 Add ledger recording, cap checks, and flush loop in worker
- [x] 1.4 Add ledger metrics + env config
- [x] 1.5 Add verification script
- [x] 1.6 Update runbook + env.example

### Phase 2: Verification
- [x] 2.1 Local fork: create ledger entries, flush batch reimbursement
- [ ] 2.2 Confirm retry/backoff on failure

### Phase 3: Wrap-up
- [x] 3.1 Update OpenSpec tasks checklist
- [x] 3.2 Update progress log

## Decisions
| Decision | Rationale |
|---|---|
| Record ledger entries in worker after prewrite | Execution service runs before trade ID exists; worker has DB + trade ID |
| Use deferReimbursement flag to skip immediate reimburse | Keeps existing settlement flow intact when ledger disabled |
| Enforce float cap in worker before execution | Worker can query ledger sums safely |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| session-catchup.py missing (CLAUDE_PLUGIN_ROOT unset) | 1 | Proceeded without catchup |
| Prisma migrate failed (schema not found from repo root) | 1 | Ran migration from `frontend` with DATABASE_URL |
| Prisma validation error (missing opposite relation) | 1 | Added `reimbursementLedger` relation to CopyTrade |
