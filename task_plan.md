# 任务计划：核心代码深度分析与中文注释

## 目标
- 深入分析项目核心执行链路，补全关键流程/关键逻辑的中文注释。
- 注释要解释“为什么这样做”和“失败时如何回滚”，不仅描述代码字面行为。

## 范围
- `src/services/trading-service.ts`
- `src/services/market-service.ts`
- `src/services/smart-money-service.ts`
- `src/services/copy-trading-execution-service.ts`
- `src/core/tx-monitor.ts`
- `src/core/tx-mutex.ts`

## 分阶段
- [complete] 阶段 1：梳理核心链路与注释策略
- [complete] 阶段 2：补充交易与市场数据主流程注释（Trading/Market）
- [complete] 阶段 3：补充智能资金与复制执行注释（SmartMoney/CopyExecution）
- [complete] 阶段 4：补充并发与交易监控注释（TxMutex/TxMonitor）
- [complete] 阶段 5：构建验证与交付说明
- [complete] 阶段 6：补充 Worker 与 API 端到端流程注释（Execution/Config/Detect/Readiness）
- [complete] 阶段 7：补充查询与风控聚合链路注释（Orders/Positions/Metrics/Guardrail/Supervisor）
- [complete] 阶段 8：补充配置控制面注释（Supervisor/Worker Env 配置 + SmartMoney 筛选评分）
- [complete] 阶段 9：补充核心服务尾段注释（Trading/Market/CopyExec/TxMutex/TxMonitor 深化）
- [complete] 阶段 10：补充核心服务前半段注释（初始化/缓存/地址路由/守卫入口）
- [complete] 阶段 11：补充阈值与降级语义注释（Readiness/Spread/Execution Fallback）

## 注释策略
1. 入口注释：说明模块职责与上下游依赖。
2. 流程注释：在关键函数内标出阶段（预检、执行、回滚、结算）。
3. 风险注释：解释并发锁、滑点、授权、资金回流等风险控制点。
4. 约束注释：写明与 Polymarket/CLOB/CTF 相关的业务约束。

## 错误记录
| 时间 | 位置 | 错误 | 处理 |
|---|---|---|---|
| - | - | 暂无 | - |
