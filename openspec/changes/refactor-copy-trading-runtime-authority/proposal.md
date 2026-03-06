# Change: Refactor Copy Trading Runtime Authority

## Why

当前仓库同时保留 supervisor、旧 worker 和 execute API 三种执行权威，导致自动执行、市场结算、恢复和文档语义分叉。需要明确唯一自动执行 authority runtime，避免不同进程对同一笔跟单维护不同状态机。

## What Changes

- 将 Supervisor + Orchestrator + ExecutionService 定义为唯一自动执行主链
- 将旧 worker 降级为兼容/实验路径，不再作为默认生产自动执行入口
- 让兼容 API 只做代理或人工操作，不再维护独立自动执行语义
- 更新启动脚本、运维文档和兼容边界

## Impact

- Affected specs: `copy-trading`
- Affected code:
  - `web/scripts/workers/copy-trading-supervisor.ts`
  - `web/scripts/workers/copy-trading-worker.ts`
  - `web/app/api/copy-trading/execute/route.ts`
  - `web/package.json`
  - `docs/operations/copy-trading-logic.md`
