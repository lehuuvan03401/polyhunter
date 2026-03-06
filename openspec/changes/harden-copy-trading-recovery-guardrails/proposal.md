# Change: Harden Copy Trading Recovery and Guardrails

## Why

当前文档描述的 stale pending expiration、延迟报销、market resolution 和 guardrail 韧性，在 `web` authority runtime 上并未完全闭环。Supervisor 仍缺少部分恢复所有权与并发安全保护。

## What Changes

- 为 authority runtime 补齐 stale `PENDING` expiration
- 将 deferred reimbursement ledger create/flush/retry 收敛到 supervisor
- 将 market resolution / redeem follow-up 收敛到 supervisor
- 为 guardrail 增加 reservation-safe 并发保护与可观测性

## Impact

- Affected specs: `copy-trading`, `copy-execution`
- Affected code:
  - `web/scripts/workers/copy-trading-supervisor.ts`
  - `sdk/src/services/copy-trading-execution-service.ts`
  - reimbursement / debt adapters and verify scripts
  - operational docs and metrics
