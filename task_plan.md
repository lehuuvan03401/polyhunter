# Task Plan: Analyze Copy Trading Logic

## Goal
结合 `docs/operations/copy-trading-logic.md` 与实际代码，梳理项目中跟单交易的完整业务链路、关键状态与风控补偿机制，并给出需要完善的点。

## Current Phase
Phase 5

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Architecture Trace
- [x] Locate copy-trading entrypoints and execution pipeline
- [x] Map storage, worker, supervisor, and API responsibilities
- [x] Record concrete code references
- **Status:** complete

### Phase 3: Risk & Gap Analysis
- [x] Compare documentation with implementation
- [x] Identify correctness, resilience, and operability gaps
- [x] Prioritize issues by severity and impact
- **Status:** complete

### Phase 4: Verification
- [x] Re-read notes and validate code references
- [x] Check whether claims are backed by implementation
- [x] Tighten recommendations
- **Status:** complete

### Phase 5: Delivery
- [x] Deliver concise review with findings first
- [x] Include open questions and improvement directions
- [x] Ensure file references are precise
- **Status:** complete

## Key Questions
1. 当前跟单交易的主链路如何从配置、事件摄取、执行、持仓更新、债务恢复串起来？
2. 现有实现在哪些地方仍依赖隐式假设，可能导致风险、数据不一致或运维复杂度上升？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先做代码走读而不是直接评论文档 | 用户要求“结合代码”深入分析，结论必须以实现为准 |
| 使用磁盘计划文件记录过程 | 这次任务会跨多个文档和模块，避免上下文漂移 |
| 优化计划拆成 3 个 OpenSpec changes | 将“账本正确性 / 运行时权威 / 恢复与风控”分离，便于审批和分阶段实现 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `rg` regex parse error while searching reimbursement usage | 1 | 改为使用简单关键词分次检索，避免复杂正则在 CLI 中解析失败 |
| `openspec validate --strict --no-interactive` returned "Nothing to validate" | 1 | 改用 `openspec validate --changes --strict --no-interactive` 进行全量 change 校验 |

## Notes
- 重点关注 `web` 目录下的 API、lib、workers、Prisma schema 与运维文档。
- 最终输出按 review 方式组织，优先给出发现的问题，再补充整体链路说明。
