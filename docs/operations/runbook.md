全链路仿真验证指南 (Final Runbook)
为了在本地 100% 真实还原 线上环境，我们需要按顺序初始化所有组件。请打开 4 个终端窗口，严格按以下步骤操作：

🖥️ 终端 1: 启动 Mainnet Fork 节点
这是我们的模拟“主网”。

bash
cd contracts
export ENABLE_FORK=true
# 确保 web/.env 中已设置 NEXT_PUBLIC_CHAIN_ID=1337
npx hardhat node

🖥️ 终端 2: 部署基础设施 (合约 & Proxy)
这步会部署 Executor、Factory，并为您的账号创建 Proxy 和充值 USDC，同时初始化 on-chain allowlist 与执行绑定。

bash
# 1. 部署 Executor & 初始化 Worker Fleet + Allowlist
cd contracts
npx hardhat run scripts/deploy-executor.ts --network localhost
# ✅ 脚本会自动更新 .env 中的 NEXT_PUBLIC_EXECUTOR_ADDRESS
# ✅ 脚本会根据 USDC_ADDRESS / CTF_ADDRESS 自动设置 Executor allowlist

# 2. 部署 Factory & 创建 User Proxy
# 注意：此脚本会读取 web/.env
npx hardhat run scripts/setup-local-fork.ts --network localhost
# ✅ 脚本会自动更新 .env 中的 NEXT_PUBLIC_PROXY_FACTORY_ADDRESS
# ✅ 新 Proxy 默认绑定 Executor，并在 Proxy/Executor 上初始化 allowlist（USDC + CTF）

(脚本执行完毕后，.env 已自动更新，直接进行下一步)

🖥️ 终端 3: 初始化数据 & 启动 Supervisor
配置跟单关系，并启动监控服务。

bash
cd web
# 1. 写入数据库配置 (Master 跟单 0x7099...Trader)
npx tsx scripts/db/seed-test-config.ts

# 2. 启动 Supervisor (企业版)
# ✅ 特性已激活: 
# - 任务队列 (Job Queue): 防止并发丢单
# - 自动加油站 (Auto-Refuel): 监控 Fleet 余额
# - 内存池嗅探 (Mempool Sniping): 支持批量转账
# ✅ 本地仿真优化:
# 当检测到 Localhost (ChainID 31337) 时，TradingService 会自动进入 "Mock Mode"：
# 跳过真实 CLOB 鉴权，模拟下单成功，避免 401/404 错误。

npx tsx scripts/workers/copy-trading-supervisor.ts

您应该看到 Supervisor 启动并显示 Fleet: 20/20 ready，且能够看到 [TaskQueue] 日志。

🖥️ 终端 4: 触发模拟交易 (Trigger)
模拟那个被跟单的大户 (0x7099...) 发起交易。

bash
cd web
# 模拟普通转账
npx tsx scripts/debug/impersonate-mainnet-trade.ts
# 或者模拟批量转账 (测试 Mempool Detector)
# 暂无批量版脚本；如后续新增，请放在 scripts/debug/ 下

👀 预期结果 (Success Criteria):

终端 4 显示 ✅ Signal Sent!。
终端 3 (Supervisor) 显示：
🚨 SIGNAL DETECTED
Dispatching 1 jobs...
CopyExec 日志流畅输出：
*   **Standard**: `Pull Funds` -> `Place Order` -> `Push`
*   **Smart Buffer**: `Check Buffer` -> `Place Order` -> `Push` -> `Reimburse` (并行/异步)
最后显示 ✅ Job Complete。
如果不报错，恭喜您！这套系统已经准备好上战场了。

---

## 托管理财（Managed Wealth）准备金与应急控制

### 1) 日常巡检（准备金覆盖率）

启动前端服务后，检查准备金摘要：

```bash
curl -s http://localhost:3000/api/reserve-fund/summary | jq
```

重点字段：
- `currentBalance`：准备金当前余额
- `outstandingGuaranteedLiability`：保底责任敞口
- `coverageRatio`：覆盖率（`currentBalance / outstandingGuaranteedLiability`）
- `requiredCoverageRatio`：系统要求阈值（取保底产品配置上限）
- `shouldPauseGuaranteed`：是否应暂停保底产品新申购

### 2) 准备金注资/调整（手动记账）

当前 MVP 暂无管理端写入 API，运维可通过 SQL 插入 `ReserveFundLedger`：

```bash
cd web
psql "$DATABASE_URL" <<'SQL'
INSERT INTO "ReserveFundLedger" ("id", "entryType", "amount", "balanceAfter", "note", "createdAt")
VALUES (md5(random()::text || clock_timestamp()::text), 'DEPOSIT', 10000, NULL, 'OPS_TOPUP_2026-02-14', NOW());
SQL
```

可选类型：
- `DEPOSIT`：注资
- `WITHDRAW`：提取
- `ADJUSTMENT`：审计调整

说明：`balanceAfter` 可留空，系统会按流水实时聚合余额；建议 `note` 带工单号。

### 3) 紧急暂停保底新申购

当 `coverageRatio < requiredCoverageRatio` 或风险事件触发时，立即暂停保底产品：

```bash
cd web
psql "$DATABASE_URL" <<'SQL'
UPDATE "ManagedProduct"
SET "status" = 'PAUSED', "updatedAt" = NOW()
WHERE "isGuaranteed" = true AND "status" <> 'ARCHIVED';
SQL
```

说明：已在运行中的订阅不受影响，仅阻止新增保底申购。

### 4) 恢复保底申购

准备金补足后恢复：

```bash
cd web
psql "$DATABASE_URL" <<'SQL'
UPDATE "ManagedProduct"
SET "status" = 'ACTIVE', "updatedAt" = NOW()
WHERE "isGuaranteed" = true AND "status" = 'PAUSED';
SQL
```

恢复前建议满足：
1. `coverageRatio >= requiredCoverageRatio`
2. 连续两次巡检（间隔 >= 5 分钟）均达标

### 5) 结算链路快速验证

在本地可执行托管理财全链路验证脚本：

```bash
cd web
MW_VERIFY_BASE_URL=http://localhost:3000 npm run verify:managed-wealth:lifecycle
```

### 6) 查询风险事件（管理员）

实时查看过去 24h 的风险事件（需 `x-admin-wallet` 鉴权头）：

```bash
# 全部事件
curl -s "http://localhost:3000/api/managed-risk-events?limit=100" \
  -H "x-admin-wallet: <ADMIN_WALLET>" | jq '.stats'

# 仅 ERROR 级别
curl -s "http://localhost:3000/api/managed-risk-events?severity=ERROR&limit=50" \
  -H "x-admin-wallet: <ADMIN_WALLET>" | jq '.events[].description'
```

前端路径：`/dashboard/admin/managed-wealth` → Risk Events 面板（支持按 severity 筛选）

### 7) 取消 PENDING 认购（管理员）

```bash
curl -s -X POST "http://localhost:3000/api/managed-subscriptions/<SUB_ID>/cancel" \
  -H "x-admin-wallet: <ADMIN_WALLET>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"admin_override"}'
```

注意：仅 `PENDING` 状态的认购可以取消，取消后自动释放本金预留。

---

### 8) 定时巡检看门狗（Ops Watchdog）

定期运行健康检查，评估 5 个核心指标并在超阈值时以 exit 1 退出（适合接入 Slack/PagerDuty 告警）：

```bash
# 单次运行（默认阈值）
cd web
MW_OPS_BASE_URL=http://localhost:3000 \
MW_OPS_ADMIN_WALLET=<ADMIN_WALLET> \
npm run verify:managed-wealth:ops-watchdog
```

**可配置告警阈值（全部可选）：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MW_OPS_BASE_URL` | http://localhost:3000 | 应用地址 |
| `MW_OPS_ADMIN_WALLET` | — | 鉴权钱包地址（也可用 `ADMIN_WALLETS` 首个）|
| `MW_OPS_MAX_UNMAPPED` | 5 | 未映射认购超过此值触发告警 |
| `MW_OPS_MAX_BACKLOG` | 10 | 清仓积压超过此值触发告警 |
| `MW_OPS_MAX_PARITY_ISSUES` | 0 | 结算一致性问题超过此值触发告警 |
| `MW_OPS_MAX_FAILED_TASKS` | 3 | FAILED 清仓任务超过此值触发告警 |
| `MW_OPS_MAX_24H_ERRORS` | 5 | 24h ERROR 级风险事件超过此值触发告警 |

**PM2 定时调度（每 5 分钟）：**

```bash
# ecosystem.config.cjs 中添加：
{
  name: 'managed-wealth-watchdog',
  script: 'npx',
  args: 'tsx scripts/verify/managed-wealth-ops-watchdog.ts',
  cwd: '/path/to/web',
  cron_restart: '*/5 * * * *',
  autorestart: false,
  env: {
    MW_OPS_BASE_URL: 'http://localhost:3000',
    MW_OPS_ADMIN_WALLET: '<ADMIN_WALLET>',
  }
}
```

---

## 托管理财 Worker 环境变量


| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MANAGED_WEALTH_LOOP_INTERVAL_MS` | 60000 | Worker 循环间隔（ms） |
| `MANAGED_WEALTH_RUN_ONCE` | false | 单次执行模式（调试用） |
| `MANAGED_WEALTH_MAP_BATCH_SIZE` | 100 | 每轮最多处理的 mapping 数量 |
| `MANAGED_WEALTH_NAV_BATCH_SIZE` | 500 | 每轮最多刷新的 NAV 数量 |
| `MANAGED_WEALTH_SETTLEMENT_BATCH_SIZE` | 300 | 每轮最多结算的认购数量 |
| `MANAGED_WEALTH_FULL_REFRESH_INTERVAL` | 20 | 每 N cycle 做一次全量 mapping 扫描（对齐 Agent 配置变更）|
| `MANAGED_NAV_DRAWDOWN_ALERT_THRESHOLD` | 0.25 | NAV 回撤超过此比例写入 DRAWDOWN_ALERT 风险事件（0.25 = 25%）|
| `MANAGED_ALLOCATION_SNAPSHOT_ENABLED` | true | 是否启用分配快照 |
| `MANAGED_MULTI_TARGET_EXECUTION_ENABLED` | false | 是否启用多目标执行 |
| `MANAGED_ALLOCATION_TARGET_COUNT` | 3 | 多目标执行下的最大目标数 |
| `MANAGED_LIQUIDATION_RETRY_BASE_MS` | 120000 | 清仓重试的基准退避间隔（ms）|
| `MANAGED_LIQUIDATION_MAX_ATTEMPTS` | 50 | 清仓任务最大重试次数，超过后标记 FAILED |

## 托管理财 API/认购环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PARTICIPATION_MANAGED_MIN_PRINCIPAL_USD` | 500 | 最低认购本金 (USD) |
| `MANAGED_WITHDRAW_COOLDOWN_HOURS` | 6 | 赎回冷静期（小时）|
| `MANAGED_EARLY_WITHDRAW_FEE_RATE` | 0.01 | 提前赎回费率（1%）|
| `MANAGED_WITHDRAW_DRAWDOWN_ALERT_THRESHOLD` | 0.35 | 提前赎回时回撤预警阈值 |
| `MANAGED_RATE_LIMIT_WINDOW_MS` | 300000 | 认购频率限制窗口（5分钟）|
| `MANAGED_RATE_LIMIT_MAX_PER_WINDOW` | 3 | 频率限制窗口内最多创建认购数 |
| `MANAGED_TRIAL_MIN_ACCOUNT_AGE_DAYS` | 1 | 账户最低年龄（天），小于此值不可获得试用 |
| `PARTICIPATION_REQUIRE_MANAGED_ACTIVATION` | false | 策略门控：是否要求激活注册 |
| `PARTICIPATION_REQUIRE_CUSTODY_AUTH` | false | 策略门控：是否要求托管授权 |

---


## Copy Trading 执行环境变量（核心）

完整清单见 `web/.env.example`。以下是执行相关的核心项：

- `ENABLE_REAL_TRADING`：真实执行开关
- `COPY_TRADING_EXECUTION_ALLOWLIST`：执行白名单（可选）
- `COPY_TRADING_MAX_TRADE_USD`：单笔上限（可选）
- `COPY_TRADING_DAILY_CAP_USD` / `COPY_TRADING_WALLET_DAILY_CAP_USD`：日限额（可选）
- `COPY_TRADING_RPC_URL` / `COPY_TRADING_RPC_URLS`：执行 RPC（支持多节点兜底）
- `COPY_TRADING_WORKER_KEYS` / `COPY_TRADING_WORKER_INDEX`：多 Worker 分片
- `COPY_TRADING_MAX_RETRY_ATTEMPTS`：失败重试次数
- `COPY_TRADING_ASYNC_SETTLEMENT`：异步结算开关（启用后 push/reimburse 进入队列）
- `COPY_TRADING_SETTLEMENT_MAX_RETRY_ATTEMPTS`：结算重试次数上限
- `COPY_TRADING_SETTLEMENT_RETRY_BACKOFF_MS`：结算重试退避基准（ms）
- `COPY_TRADING_LEDGER_ENABLED`：启用报销账本（Bot 浮动资金批量报销）
- `COPY_TRADING_LEDGER_FLUSH_AMOUNT`：账本累计达到该金额时触发批量报销
- `COPY_TRADING_LEDGER_MAX_AGE_MS`：账本单条最大等待时长
- `COPY_TRADING_LEDGER_OUTSTANDING_CAP`：单代理累计欠账上限，超过则禁用 float
- `COPY_TRADING_LEDGER_FLUSH_INTERVAL_MS`：账本刷新间隔
- `COPY_TRADING_LEDGER_MAX_RETRY_ATTEMPTS`：账本重试上限
- `COPY_TRADING_LEDGER_RETRY_BACKOFF_MS`：账本重试退避基准（ms）
- `COPY_TRADING_LEDGER_CLAIM_BATCH`：账本单次领取/处理的最大条数

建议在启动 worker 前运行就绪检查：
```
cd sdk && npx tsx scripts/verify/copy-trading-readiness.ts
```

若启用 `COPY_TRADING_ASYNC_SETTLEMENT=true`，订单会先执行、结算（push/reimburse）进入异步队列：
- 交易记录可能出现 `SETTLEMENT_PENDING` 状态
- 需要保证 worker 的结算恢复循环常驻运行
- 关注队列指标（depth/lag/retry）以避免资产滞留

若启用 `COPY_TRADING_LEDGER_ENABLED=true`，Bot float 的报销会进入账本批量结算：
- 浮动资金会按金额/时长阈值批量报销，减少链上 TX
- 若 `OUTSTANDING_CAP` 超过上限，float 会自动关闭并走 Proxy 直扣
- 关注账本指标（depth/outstanding/lag/retry）避免报销积压

---

## Supervisor 扩容与共享存储（多实例）

当需要 **多实例部署** 来支撑大量用户/跟单量时，建议启用共享存储与分片：

### 1) 共享 Redis（队列 + 去重 + Guardrail 计数）
设置以下任一环境变量：
- `SUPERVISOR_REDIS_URL`（优先）
- `REDIS_URL`（兜底）

若未设置，将退回内存模式（仅适用于单实例）。
如需启用 Redis，请确保已安装 `ioredis`（在 `web` 目录执行 `npm install ioredis`）。

### 2) 分片（避免多实例重复处理）
每个实例设置不同分片：
- `SUPERVISOR_SHARD_COUNT=4`
- `SUPERVISOR_SHARD_INDEX=0|1|2|3`

### 3) 监听过滤（降低 WS 噪声）
默认启用地址过滤：
- `SUPERVISOR_WS_FILTER_BY_ADDRESS=true`（默认）
设置为 `false` 将订阅全量 activity。

### 3.1) 信号源模式（WS / Polling / Hybrid）
- `COPY_TRADING_SIGNAL_MODE=HYBRID`（默认，推荐）
  - `WS_ONLY`：仅 WebSocket（最低延迟，可靠性依赖 WS）
  - `POLLING_ONLY`：仅轮询（不依赖 WS，可靠性更高）
  - `HYBRID`：WS + Polling 并行，去重后只执行一次（推荐生产）
- Polling 相关参数：
  - `SUPERVISOR_POLLING_BASE_INTERVAL_MS`（默认 `5000`）
  - `SUPERVISOR_POLLING_MAX_INTERVAL_MS`（默认 `10000`）
  - `SUPERVISOR_POLLING_LIMIT`（默认 `200`）
  - `SUPERVISOR_POLLING_LOOKBACK_SECONDS`（默认 `90`）
  - `SUPERVISOR_WS_UNHEALTHY_THRESHOLD_MS`（默认 `30000`）
  - `SUPERVISOR_SIGNAL_SOURCE_WINDOW_MS`（默认 `120000`）
- `HYBRID` 下当 WS 长时间无事件，会进入 degraded 状态并继续依赖 polling；无需重启。
- `POLLING_ONLY` 下会关闭 WS/chain/mempool 监听，仅由 polling 触发信号。

### 4) 性能调参
- `SUPERVISOR_FANOUT_CONCURRENCY=25`：同一交易的并发分发上限
- `SUPERVISOR_QUEUE_MAX_SIZE=5000`：队列容量（满则丢弃并记录指标）
- `SUPERVISOR_QUEUE_DRAIN_INTERVAL_MS=500`：队列自动排空周期
- `SUPERVISOR_DEDUP_TTL_MS=60000`：去重 TTL
- `SUPERVISOR_GUARDRAIL_CACHE_TTL_MS=5000`：Guardrail 计数缓存 TTL
- `SUPERVISOR_MARKET_META_TTL_MS=300000`：市场元数据缓存 TTL
- `SUPERVISOR_WORKER_POOL_SIZE=20`：每实例 worker 数量（默认 20）
- `SUPERVISOR_CONFIG_REFRESH_MS=10000`：增量配置刷新间隔
- `SUPERVISOR_CONFIG_FULL_REFRESH_MS=300000`：全量配置重建间隔

### 5) 容量规划（10k 用户基线）
假设：10k 用户 × 每人跟 10 个交易员 × 每人 5k 单/天。

- 总跟单量/天：50,000,000
- 平均跟单量/秒：约 579/s
- 若平均执行延迟 250ms，20 workers/实例 → 单实例吞吐约 80/s
- 建议实例数：8（均值）/ 16（2x headroom）/ 24（3x 峰值）

相关部署步骤见：`docs/operations/deploy-supervisor-capacity-controls.md`  
上线 SOP 见：`docs/operations/sop-supervisor-capacity-controls.md`
发布说明见：`docs/operations/release-notes.md`

### 6) 故障排查（Signal Ingestion）
- 日志出现 `WS unhealthy ... Polling remains active`：说明已自动降级到 polling，检查 WS 提供商健康。
- 指标 `source_mismatch_rate` 持续升高：说明 WS 和 polling 观察到的事件集合偏差变大，优先排查 WS 订阅过滤和 Data API 限流。
- 指标 `poll_lag_ms` 持续升高：提高 `SUPERVISOR_POLLING_LIMIT`，降低 `SUPERVISOR_POLLING_BASE_INTERVAL_MS`，并确认 Data API 可用性。
- 若出现 `Failed to read/persist signal cursor`：先执行 Prisma 迁移，再重启 supervisor。

### 7) 上游同步迁移说明（RealtimeServiceV2 -> Polling 对齐）
- 背景：上游已弱化/移除 Activity WS 路径，建议切到 polling 语义。
- 建议 rollout：
  1. Staging：`COPY_TRADING_SIGNAL_MODE=POLLING_ONLY` 验证完整链路；
  2. Production：切 `HYBRID`，观察 `source_mismatch_rate` 与 `poll_lag_ms`；
  3. 稳定后再评估是否长期 `POLLING_ONLY`。
- 回滚：
  - 将 `COPY_TRADING_SIGNAL_MODE=WS_ONLY` 后重启 supervisor。
  - `SignalCursor` 表可保留（仅状态数据，不影响 WS_ONLY 运行）。

---

## 主网迁移步骤（新合约逻辑）

当合约逻辑有变更（如 Executor 绑定、allowlist、pause）时，需要 **重新部署** 并迁移用户到新 Proxy。建议步骤如下：

### 1) 部署新 Executor + 设置 Allowlist
```bash
cd contracts
USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 \
CTF_ADDRESS=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045 \
npx hardhat run scripts/deploy-executor.ts --network polygon
```
输出新的 `NEXT_PUBLIC_EXECUTOR_ADDRESS`，并确保 **Executor allowlist 已包含 USDC + CTF**。

### 2) 部署新 ProxyFactory（绑定新 Executor）
```bash
cd contracts
USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 \
CTF_ADDRESS=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045 \
npx hardhat run scripts/deploy.ts --network polygon
```
输出新的 `ProxyFactory/Treasury/Executor` 地址，并更新 `.env` / `deployed-addresses.json`。

### 3) 更新运行环境
- `PROXY_FACTORY_ADDRESS` / `EXECUTOR_ADDRESS` / `USDC_ADDRESS` / `CTF_ADDRESS`
- `NEXT_PUBLIC_*` 前端地址同步更新

### 4) 为执行钱包创建 Proxy
使用执行钱包（TRADING_PRIVATE_KEY）在新 Factory 上创建 Proxy（或通过前端用户钱包创建）。

### 5) 迁移用户资金（旧 Proxy -> 新 Proxy）
建议策略（按需选择）：
- **用户主动迁移**：用户自行提款 → 再入金到新 Proxy
- **运营协助**：提供迁移提示与引导（避免直接代转）

### 6) 废弃旧 Proxy
- 旧 Proxy 不具备新的安全护栏（allowlist/pause/绑定），建议 **停止新交易** 并引导迁移。


setup-local-fork.ts 的说明：

部署 Executor (🚀 Deploying Executor):
部署执行中枢合约，并初始化 allowlist（默认 USDC.e + CTF）。
部署 ProxyFactory (🏭 Deploying ProxyFactory):
虽然主网上已经有 Factory 了，但我们在本地无法控制它（比如无法随意设置 Owner）。
所以我们部署一个全新的、属于您的 Factory。通过构造函数，我们将它指向真实的 USDC 和 CTF，并绑定 Executor，这样它创建出来的 Proxy 就能和真实世界的合约交互，并且执行入口受控。
创建 Proxy Wallet (👤 Creating Proxy):
调用刚才部署的新 Factory，为您（Hardhat 默认账号 #0）创建一个智能合约钱包。
充值 USDC (💰 Funding Proxy):
这是最酷的一步。您的新 Proxy 钱包刚创建，里面没钱。
脚本使用 hardhat_impersonateAccount 功能，冒充了一个已知的 USDC 巨鲸用户（Binance 热钱包 0xe780...）。
脚本强制让这个巨鲸给您的 Proxy 转账 1000 USDC。
这只有在 Fork 模式下才能做到（我们在本地拥有上帝视角，可以控制任意账户），从而免去了测试时找水龙头领币的麻烦。
