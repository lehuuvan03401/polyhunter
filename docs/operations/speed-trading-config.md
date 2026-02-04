“极速模式”配置清单
1) .env 极速配置（建议）
# RPC（高性能）
NEXT_PUBLIC_RPC_URL=https://你的高性能RPC
COPY_TRADING_RPC_URLS=https://rpc1,https://rpc2  # 可选：多 RPC failover

# mempool provider（更快）
MEMPOOL_PROVIDER=Alchemy
NEXT_PUBLIC_ALCHEMY_API_KEY=你的key

# 缓存与性能 (2026-02)
COPY_TRADING_PRICE_TTL_MS=2000
COPY_TRADING_PREFLIGHT_CACHE_TTL_MS=2000
COPY_TRADING_QUOTE_CACHE_MAX_ENTRIES=500

# 交易控制
ENABLE_REAL_TRADING=true
COPY_TRADING_DRY_RUN=false
MAX_SLIPPAGE=0.5

2) setup-real-trading.ts 执行前检查
cd frontend
npx tsx scripts/setup-real-trading.ts
确认：

Proxy/EOA 地址正确
USDC allowance / CTF approval ok
Slippage 设置正确

3) 极速执行建议（必须）
只跑一个 worker（避免重复并发）
固定小额（比如 1–5/单）
RPC 多节点（失败自动切换）

4) 监控与安全（必须）
检查 guardrail-service.ts：

ENABLE_REAL_TRADING=true
EXECUTION_ALLOWLIST=[你的钱包]
MAX_TRADE_USD=10
GLOBAL_DAILY_CAP_USD=100
WALLET_DAILY_CAP_USD=50
MAX_SLIPPAGE=0.5

4) 滑点控制要点
你已经有：

orderbook 实时价
max slippage guard
价格上限 skip
建议你再加：

当盘口价差过大时自动 skip
当前盘口深度不足时 skip（比如 best bid/ask size 太小）