最简、最安全的“真实跟单”启动流程（用 setup-real-trading.ts 作为入口）

一、准备工作（必须）

准备钱包与资金
在 Polymarket 上注册/登录并创建钱包（或用你自己的 EOA）
充值 USDC.e 到 Polygon（不是原生 USDC）
建议先充 5–20 USDC 做验证

**[High Performance Optional]**: 如果你想启用 **Smart Buffer** 策略（极速模式），请也往 **Worker Bot (TRADING_MNEMONIC)** 对应的地址充值 50-100 USDC。这样 Bot 可以直接垫资买入，无需等待 Proxy 转账，由于减少了 50% 的链上交互，速度会有显著提升。
本地环境变量（frontend/.env）
至少要有：
TRADING_PRIVATE_KEY=你的私钥（小额测试专用）
NEXT_PUBLIC_RPC_URL=你自己的稳定RPC（比如 Alchemy/Ankr）
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_NETWORK=polygon
如果你使用 Proxy 模式，还要填：

NEXT_PUBLIC_PROXY_FACTORY_ADDRESS=...
NEXT_PUBLIC_USDC_ADDRESS=0x2791...
NEXT_PUBLIC_CTF_ADDRESS=...
NEXT_PUBLIC_TREASURY_ADDRESS=...
NEXT_PUBLIC_EXECUTOR_ADDRESS=...
二、运行 setup‑real‑trading（配置授权）
进入 frontend/：

cd frontend
npx tsx scripts/setup-real-trading.ts
这个脚本会：

检查钱包与 Proxy 地址
自动做 USDC 授权、CTF approval（如果你选择）
输出是否已准备好真实交易
建议你先设置一个小额 slippage（比如 0.5%）

三、验证“真实成交能力”（小额、低频）

在 frontend/.env 临时添加：
COPY_TRADING_DRY_RUN=false
运行真实执行器（server 端路由已经支持）
npm run dev
用 UI 启动一个 Copy Trading 配置（设置固定金额，比如 $1）

看控制台和链上 Tx：

如果看到 tx hash 并且在 PolygonScan 上可查，就表示真实交易成功
最关键的安全建议
只用小额测试专用钱包
私钥不要用于大额资产
只跑 1 个 worker（避免并发重复执行）

如果你要“最快看到真实交易”
告诉我你更倾向的模式：

Proxy 模式（推荐，资金留在 proxy）
EOA 模式（直接私钥下单）

1) Proxy 模式 vs 2) EOA 模式核心区别

Proxy 模式：交易由 Proxy 合约执行（你授权 Proxy + Executor），逻辑更可控，可加风控/白名单/限额等。
EOA 模式：直接用你的私钥下单，链路更短，但安全隔离弱。
性能/速度差别大吗？

差别不大，最终都走同一 RPC、同一 CLOB 下单流程。
Proxy 模式现在已升级为 **"Smart Buffer"** 混合模式。
*   如果不充 Bot Buffer: 走标准流程 (Pull -> Trade -> Push)，比 EOA 慢 1 个区块。
*   **如果充 Bot Buffer**: 走极速流程 (Trade -> Push -> Reimburse)，速度与 EOA 持平，且资金最终仍归集在 Proxy，兼顾速度与安全。

滑点方面有没有考虑？
有，项目里已经做了两层控制：

执行前基于 leader 价格 + 允许滑点（例如 0.5%）
执行时用 orderbook 估价（最近已加了 best price 逻辑）
不过注意：

极端行情下仍可能滑点超预期（订单簿瞬间变薄）
如果你想更稳，可以把 maxSlippage 设置更保守，比如 0.3%–0.5%
可以在脚本里增加 “MaxExecPrice 上限”，超过就直接 skip（已经加了 guard）
简要建议

想速度 + 安全：Proxy 模式（推荐）
想最快验证成交：EOA 也可以，但用小额测试钱包
速度差异通常 < 1 秒，真正影响是 RPC/网络

如果你要做“极速复制”，我建议：

使用高质量 RPC（Alchemy/QuickNode/Ankr 专线）
开启 mempool provider
把 maxSlippage 设置合理（0.5% 或更小）

