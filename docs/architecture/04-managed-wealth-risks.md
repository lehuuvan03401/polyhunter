# 托管理财 (Managed Wealth) 流程架构风险分析评估

在深入分析 `managed-wealth-worker.ts` 和 `managed-settlement-service.ts` 等核心代码后，发现该生命周期模型在目前状态下存在几个比较严重的架构风险和逻辑漏洞。主要集中在并发处理、极端行情下的平仓以及性能扩展上：

## 1. 缺乏分布式锁导致严重的并发竞态 (Concurrency Risk)
- **现状**：Worker 脚本内部仅使用了一个内存变量 `let running = false;` 来防止单进程内的重入执行。
- **风险**：如果在生产环境中通过 PM2 Cluster、Docker/K8s 部署了多个 Worker 实例（横向扩展），它们同时连接到数据库并捞取相同状态的订单（如 `PENDING` 或 `MATURED`）。由于查询如 `findMany` 并未使用依靠数据库层面排他锁（如 Postgres 的 `SELECT ... FOR UPDATE SKIP LOCKED`），多个 Worker 会同时处理相同的数据。这极可能导致：同一位用户的底仓被重复建立映射、结算流程（`settleMaturedSubscriptions`）中的事务冲突甚至产生双重退款等金融级故障。

## 2. “清算黑洞”导致用户资金可能永久锁定 (Liquidation Stuck State)
- **现状**：当订阅到期进入 `LIQUIDATING` 状态时，Worker 会在 `liquidateSubscriptions` 阶段检查底层持仓 `openPositions`。如果仍有持仓，它会构建清算意图并向市场拉取最新的 Orderbook 报价。如果发现该市场完全没有买盘（即抛盘无人接盘），状态会被标记为 `RETRYING` (ErrorCode: `NO_BID_LIQUIDITY`)。
- **风险**：遇到极端冷门市场或者预测事件迅速下架结算但无人挂单时，该循环将进入“死结”。持仓卖不掉，订阅将无限期卡在 `LIQUIDATING` 阶段无法推进到 `SETTLED`，用户的本金将无限期被锁住。缺乏一种“最大重试超时后强行折价归0交割”或“人工接盘”的兜底机制。

## 3. 性能扩展危机与 API 滥用 (Scaling & N+1 Query Problem)
- **现状**：`refreshNavSnapshots` (刷新净值快照) 单次捞取多达 500 (`NAV_BATCH_SIZE`) 条订阅，然后在一个巨大的 `for...of` 循环里对每条记录分别调用 4 个异步数据库动作（包括 `aggregate`, `findFirst` 等）。并且如果发现新代币，会同步向 Polymarket CLOB API 请求 Orderbook。
- **风险**：
  1. **慢查询瀑布**：2000 个 DB 查询在单线程循环里串行发送（虽然有 `Promise.all` 合并单个订单的 4 个请求，但订单之间是串行的），当系统用户达到一万人时，完成一次净值扫描需要耗费极长时间，严重拖慢整个事件循环，甚至导致其他重要步骤（到期标记、结算）延误。
  2. **API 熔断风险**：如果有几千个长尾市场头寸，向交易所高频点对点查询价格很容易被风控拦截或阻断。目前采用的 `currentPriceMap` 缓存虽能缓解部分问题，但仍未将多订单多头寸合并处理。

## 4. 上下级推广分佣失败后的沉默处理 (Commission Silently Failing)
- **现状**：在结算流程的收尾阶段，如果 `affiliateEngine.distributeProfitFee` (高水位分润拨给推广者) 因网络抖动或其他运行时错误导致失败，系统会把 `ManagedSettlementExecution` 捕捉为 `FAILED`，然后仅仅打印一句 `console.error`。
- **风险**：Worker 跑完这段逻辑即宣告该用户的结算彻底完成 (`status = 'SETTLED'`)。用户正常拿到了本金和利润，但上级代理的推广佣金彻底落空，并没有任何自动重新触发发放的补偿重试机制。依赖运营人员去数据库捞取 `FAILED` 的日志手动干预，成本极高。

## 修复建议 (Recommendations)
1. **引入排他锁**：修改所有 `findMany` 捞取数据的操作，引入 Postgres `SKIP LOCKED` 或使用 Redis 分布式事务锁，确保同一时间只有一个实例在处理一笔订阅的生命周期流转。
2. **重构批处理逻辑**：NAV 扫描应当“先收集所有需要检查的去重 Token 列表” -> “一次性批处理请求所有最新价格” -> “内存计算汇总” -> “构建一份巨大的 UPSERT Batch SQL”，将万次数据库交互降为数次。
3. **建立平仓超时熔断机制**：为 `ManagedLiquidationTask` 设定 `maxAttempts` 和 `deadline`。超过一定天数如果仍然无竞价接盘，应当转移至 OTC 队列或直接判定残值为 0 强行释放。
4. **佣金异步队列**：分佣不应在核心 Worker 中耦合。应发送一个可靠的消息队列 (SQS/Redis Queue/数据库队列表) 来处理所有分润事件，利用队列本身携带的死信与补偿重试确保100%送达。
