# Copy Trading Runtime Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 收敛跟单交易运行时主链，修复账本正确性问题，并把恢复/风控闭环补到 supervisor authority runtime。

**Architecture:** 以 `web/scripts/workers/copy-trading-supervisor.ts` + `sdk/src/core/trade-orchestrator.ts` + `sdk/src/services/copy-trading-execution-service.ts` 为唯一自动执行主链。兼容入口只委托或只做人工操作；统一 position accounting writer、settlement/reimbursement recovery 与 guardrail reservation。

**Tech Stack:** TypeScript, Prisma, Next.js API routes, SDK execution services, OpenSpec, Vitest

---

### Task 1: Land the Planning Artifacts

**Files:**
- Create: `docs/plans/2026-03-06-copy-trading-runtime-hardening-design.md`
- Create: `docs/plans/2026-03-06-copy-trading-runtime-hardening.md`
- Create: `openspec/changes/fix-copy-trading-accounting-integrity/*`
- Create: `openspec/changes/refactor-copy-trading-runtime-authority/*`
- Create: `openspec/changes/harden-copy-trading-recovery-guardrails/*`

**Step 1: Validate change boundaries**

Run: `openspec list`
Expected: Existing active changes do not already cover accounting integrity or runtime authority unification end-to-end.

**Step 2: Write/refresh proposal files**

Write the three OpenSpec changes and ensure each has `proposal.md`, `tasks.md`, and spec deltas.

**Step 3: Validate proposals**

Run:
```bash
openspec validate fix-copy-trading-accounting-integrity --strict --no-interactive
openspec validate refactor-copy-trading-runtime-authority --strict --no-interactive
openspec validate harden-copy-trading-recovery-guardrails --strict --no-interactive
```
Expected: all pass.

### Task 2: Fix Position Accounting Integrity

**Files:**
- Modify: `sdk/src/core/trade-orchestrator.ts`
- Modify: `web/lib/services/position-service.ts`
- Create or modify tests near: `sdk/src/core/*.test.ts` or `web/lib/services/*.test.ts`
- Optional script: `web/scripts/db/backfill-copy-trading-position-cost-basis.ts`

**Step 1: Write failing tests for partial SELL accounting**

Test scenarios:
- BUY 100 shares @ 0.40, SELL 25 shares @ 0.60 => remaining balance 75, remaining totalCost 30, avgEntryPrice 0.40
- SELL entire position => remaining balance 0, totalCost 0, avgEntryPrice 0

**Step 2: Extract a shared position accounting writer**

Implement a reusable function/service so supervisor/orchestrator/API do not maintain separate SQL semantics.

**Step 3: Replace direct raw SQL in orchestrator**

Update `sdk/src/core/trade-orchestrator.ts` to call the shared accounting writer instead of its current ad hoc `INSERT ... ON CONFLICT` logic.

**Step 4: Add a reconciliation/backfill path**

Create a script or documented procedure to repair historical `UserPosition.totalCost` drift before rollout.

**Step 5: Run verification**

Run targeted tests and record expected results in `progress.md`.

### Task 3: Make All Execution Entry Points Use the Same Ledger Semantics

**Files:**
- Modify: `web/app/api/copy-trading/execute/route.ts`
- Modify: `sdk/src/core/trade-orchestrator.ts`
- Modify: `web/scripts/workers/copy-trading-supervisor.ts`
- Test: `web/app/api/copy-trading/execute/route.test.ts`

**Step 1: Write a failing integration-style test**

Cover API server-side execution success for BUY and SELL and assert:
- `CopyTrade.status` is updated
- `UserPosition` is updated
- SELL path produces correct realized PnL / position reduction semantics

**Step 2: Refactor execute API**

Make the API route delegate to the same post-execution ledger update flow used by orchestrator, or reject autonomous execution in automatic mode.

**Step 3: Remove state drift between paths**

Ensure manual/server-side/API execution cannot leave `CopyTrade` advanced while `UserPosition` remains stale.

**Step 4: Run tests**

Run:
```bash
pnpm --dir web test route.test.ts
```
If the repo uses a narrower Vitest target, replace with the exact route test command.

### Task 4: Establish Supervisor as the Only Automatic Authority

**Files:**
- Modify: `web/scripts/workers/copy-trading-supervisor.ts`
- Modify: `web/scripts/workers/copy-trading-worker.ts`
- Modify: `web/package.json`
- Modify docs: `docs/operations/copy-trading-logic.md`

**Step 1: Add failing regression coverage or verification script**

Assert that automatic event-driven execution is initiated only from supervisor-owned runtime paths.

**Step 2: Demote old worker responsibilities**

`web/scripts/workers/copy-trading-worker.ts` should either:
- delegate to supervisor-compatible services only, or
- be explicitly marked non-production / compatibility-only

**Step 3: Fix startup scripts**

Update `web/package.json` so production/default operator guidance does not point to the deprecated automatic worker.

**Step 4: Update operational docs**

Revise `docs/operations/copy-trading-logic.md` to describe the actual authority runtime and compatibility boundaries.

### Task 5: Port Recovery Closure into Supervisor

**Files:**
- Modify: `web/scripts/workers/copy-trading-supervisor.ts`
- Reference: `sdk/scripts/copy-trading-worker.ts`
- Modify: `sdk/src/services/copy-trading-execution-service.ts`
- Modify: `web/prisma/schema.prisma` only if schema adjustments are required

**Step 1: Add stale PENDING expiration**

Port the missing `expiresAt`/stale pending recovery semantics into supervisor/orchestrator-created trades.

**Step 2: Add deferred reimbursement ledger ownership**

When deferred reimbursement is enabled, create/update `ReimbursementLedger` entries from the authority runtime and flush them in supervisor.

**Step 3: Add market resolution ownership**

Move or re-implement winner redeem / loss settlement handling in supervisor so market resolution is not owned solely by the old worker.

**Step 4: Add tests/verification scripts**

Verify:
- pending expiration
- ledger batch flush / retry
- settlement recovery
- market resolution/redeem

### Task 6: Harden Guardrails for Concurrency

**Files:**
- Modify: `web/scripts/workers/copy-trading-supervisor.ts`
- Optional create: `web/lib/copy-trading/guardrail-reservations.ts`
- Test/verify: `web/scripts/verify/*`

**Step 1: Write a failing concurrent guardrail test**

Simulate multiple subscribers racing through guardrail checks against the same wallet/global cap.

**Step 2: Introduce reservation semantics**

Before dispatch/execute, reserve capacity in a short-lived store; on success convert to committed usage, on skip/failure release it.

**Step 3: Add observability**

Emit metrics for reserved, committed, released, and expired reservations.

**Step 4: Run verification**

Use a deterministic concurrency test or verification script to prove caps are not exceeded under burst fanout.

### Task 7: Rollout and Cleanup

**Files:**
- Modify docs under `docs/operations/`
- Modify runbooks/scripts under `web/scripts/verify/`

**Step 1: Add rollout checklist**

Document:
- backfill order
- feature flag sequence
- dual-run observation window
- shutdown order for deprecated worker

**Step 2: Run final verification suite**

Suggested commands:
```bash
openspec validate --strict --no-interactive
pnpm --dir sdk test
pnpm --dir web lint
```

**Step 3: Commit in phases**

Recommended commit sequence:
1. `spec: add copy-trading hardening proposals`
2. `fix: correct copy-trading position accounting`
3. `refactor: unify copy-trading runtime authority`
4. `feat: harden supervisor recovery and guardrails`

