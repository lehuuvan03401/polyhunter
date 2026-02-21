# Release Notes

## 2026-02-06 — Supervisor Capacity Controls

**What’s new**
- Supervisor worker pool 可配置：`SUPERVISOR_WORKER_POOL_SIZE`（默认 20）
- 配置刷新升级为增量 + 定期全量重建，显著降低 DB 压力
- 新增配置刷新指标日志（fetched / duration / timestamp）
- Runbook 增加容量规划参数与 10k 用户基线 sizing 建议
- 新增部署清单与上线 SOP

**Specs & Proposals**
- OpenSpec 变更已归档：`2026-02-06-add-supervisor-capacity-controls`
- `openspec/specs/copy-trading/spec.md` 新增 requirements（worker pool / incremental refresh / full reconcile / refresh metrics）

**DB / Migration**
- 新增索引：`CopyTradingConfig(updatedAt, isActive, autoExecute, channel)`
- Migration：`web/prisma/migrations/20260206111203_add_config_refresh_index`

**Verification Summary**
- Worker pool override 生效（日志显示 `Worker pool size: N`）
- 增量刷新可拾取新增配置
- 全量重建可清理禁用/删除配置
- 相关验证记录：`openspec/changes/archive/2026-02-06-add-supervisor-capacity-controls/verification.md`
