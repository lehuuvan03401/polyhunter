全链路仿真验证指南 (Final Runbook)
为了在本地 100% 真实还原 线上环境，我们需要按顺序初始化所有组件。请打开 4 个终端窗口，严格按以下步骤操作：

🖥️ 终端 1: 启动 Mainnet Fork 节点
这是我们的模拟“主网”。

bash
cd contracts
export ENABLE_FORK=true
# 确保 frontend/.env 中已设置 NEXT_PUBLIC_CHAIN_ID=1337
npx hardhat node

🖥️ 终端 2: 部署基础设施 (合约 & Proxy)
这步会部署 Factory, Executor，并为您的账号创建 Proxy 和充值 USDC。

bash
# 1. 部署 Executor & 初始化 Worker Fleet
cd contracts
npx hardhat run scripts/deploy-executor.ts --network localhost
# ✅ 脚本会自动更新 .env 中的 NEXT_PUBLIC_EXECUTOR_ADDRESS

# 2. 部署 Factory & 创建 User Proxy
# 注意：此脚本会读取 frontend/.env
npx hardhat run scripts/setup-local-fork.ts --network localhost
# ✅ 脚本会自动更新 .env 中的 NEXT_PUBLIC_PROXY_FACTORY_ADDRESS，并自动授权 Executor

(脚本执行完毕后，.env 已自动更新，直接进行下一步)

🖥️ 终端 3: 初始化数据 & 启动 Supervisor
配置跟单关系，并启动监控服务。

bash
cd frontend
# 1. 写入数据库配置 (Master 跟单 0x7099...Trader)
npx tsx scripts/seed-test-config.ts

# 2. 启动 Supervisor (企业版)
# ✅ 特性已激活: 
# - 任务队列 (Job Queue): 防止并发丢单
# - 自动加油站 (Auto-Refuel): 监控 Fleet 余额
# - 内存池嗅探 (Mempool Sniping): 支持批量转账
# ✅ 本地仿真优化:
# 当检测到 Localhost (ChainID 31337) 时，TradingService 会自动进入 "Mock Mode"：
# 跳过真实 CLOB 鉴权，模拟下单成功，避免 401/404 错误。

npx tsx scripts/copy-trading-supervisor.ts

您应该看到 Supervisor 启动并显示 Fleet: 20/20 ready，且能够看到 [TaskQueue] 日志。

🖥️ 终端 4: 触发模拟交易 (Trigger)
模拟那个被跟单的大户 (0x7099...) 发起交易。

bash
cd frontend
# 模拟普通转账
npx tsx scripts/impersonate-mainnet-trade.ts
# 或者模拟批量转账 (测试 Mempool Detector)
# npx tsx scripts/impersonate-batch-trade.ts (如果已创建)

👀 预期结果 (Success Criteria):

终端 4 显示 ✅ Signal Sent!。
终端 3 (Supervisor) 显示：
🚨 SIGNAL DETECTED
Dispatching 1 jobs...
CopyExec 日志流畅输出：Funds Check -> Place Order -> Settlement。
最后显示 ✅ Job Complete。
如果不报错，恭喜您！这套系统已经准备好上战场了。


setup-local-fork.ts的说明：

部署 ProxyFactory (🏭 Deploying ProxyFactory):
虽然主网上已经有 Factory 了，但我们在本地无法控制它（比如无法随意设置 Owner）。
所以我们部署一个全新的、属于您的 Factory。通过构造函数，我们将它指向真实的 USDC 和 CTF，这样它创建出来的 Proxy 就能和真实世界的合约交互了。
创建 Proxy Wallet (👤 Creating Proxy):
调用刚才部署的新 Factory，为您（Hardhat 默认账号 #0）创建一个智能合约钱包。
充值 USDC (💰 Funding Proxy):
这是最酷的一步。您的新 Proxy 钱包刚创建，里面没钱。
脚本使用 hardhat_impersonateAccount 功能，冒充了一个已知的 USDC 巨鲸用户（Binance 热钱包 0xe780...）。
脚本强制让这个巨鲸给您的 Proxy 转账 1000 USDC。
这只有在 Fork 模式下才能做到（我们在本地拥有上帝视角，可以控制任意账户），从而免去了测试时找水龙头领币的麻烦。