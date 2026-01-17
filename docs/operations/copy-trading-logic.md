1. 真实环境监听逻辑 (The Eyes)
我们在生产环境这套系统的“眼睛”由两部分组成，互为补充：

A. 🐢 区块监听 (Event Listening)

原理：Supervisor 监听 CTF 合约的 TransferSingle 事件。
代码：ctf.on("TransferSingle", handleTransfer)
逻辑：
每当链上有包含 CTF Token 的交易打包上链（Block），事件触发。
Supervisor 检查 from（卖方）或 
to
（买方）是否在我们的 monitoredTraders 列表里。
如果是，立即触发跟单。
特点：绝对可靠，不会漏单，但比该大户的交易慢 1 个区块（约 2 秒）。
B. 🦈 内存池嗅探 (Mempool Sniping - 企业级特性)

原理：Supervisor 通过 WebSocket (ws://...) 监听节点尚未打包的 Pending Transactions。
代码：src/core/mempool-detector.ts
逻辑：
实时捕获全网所有待打包交易。
解码交易数据 (input data)，看是否调用了 safeTransferFrom 或 safeBatchTransferFrom。
如果交易发起者 (from) 是我们监控的大户，立即触发跟单。
优势：理论上能与大户在同一区块甚至在大户之前（如果给更高的 Gas）成交。这就是所谓的“抢跑”。

2. 真实跟单执行逻辑 (The Hands)
当信号触发后，执行逻辑 (
src/services/copy-trading-execution-service.ts
) 非常严谨，采用了 "Bot Proxy 代理人模型"，保证资金安全：

场景一：跟随买入 (BUY)

Float Check (垫资优化)：系统先检查 Worker Bot 自己有没有闲置的 USDC。
有钱：Bot 直接用自己的钱去市场买入 Share。
没钱：Bot 从 User Proxy 钱包里“提取” USDC 到自己手里。
Market Order (下单)：Bot 使用自己的私钥，向 Polymarket CLOB 发送 FOK (Fill-Or-Kill) 市价单。
Settlement (资产交割)：
Bot 收到 Share 后，立即将 Share 转入 User Proxy 钱包。
(如果是垫资买的) Bot 从 User Proxy 提取等额 USDC 报销。
最终状态：User Proxy 持有 Share，Bot 收支平衡。
场景二：跟随卖出 (SELL)

Token Pull (提货)：Bot 从 User Proxy 钱包里把 Share 提取到自己手里。
Market Order (抛售)：Bot 在市场卖出 Share，换回 USDC。
Settlement (回款)：Bot 将得到的 USDC 全部转回 User Proxy。
最终状态：User Proxy 持有 USDC，Bot 余额清零。

3. 重大风险评估 (Risk Assessment)
虽然系统已经很健壮，但作为商业级系统，您需要了解以下 3 个核心风险：

🔴 风险 1：垫资报销失败 (Reimbursement Fail)

场景：Bot 自己垫资 $1000 买入了 Token，但在它回头找 User Proxy 报销时，发现 User Proxy 里的 USDC 被用户提走了，或者不够了。
后果：Bot 手里多了一堆 Token，但拿不回 USDC。Bot 亏损。
对策：目前的逻辑是仅打印错误日志。商业版建议增加“欠条”逻辑或在买入前强制锁定 Proxy 资金。
🔴 风险 2：链路重组 (Chain Reorg)

场景：Mempool 嗅探到了大户的交易，我们跟单成交了。结果 10 秒后，Polygon 链发生重组，大户的那笔交易最终没有上链（或者失败了）。
后果：我们跟了一笔“不存在的交易”。如果市场因此波动，我们可能蒙受损失。
对策：增加 Confirmation Block 设置（牺牲速度换安全），或者根据 PnL 策略自动止损。
🔴 风险 3：RPC 节点限流

场景：大户一笔批量转账涉及 10 个 Token，瞬间触发 10 个跟单任务。20 个 Worker 同时向 RPC 节点发起 40+ 次请求。
后果：免费节点会直接返回 429 Too Many Requests，导致所有跟单失败。
对策：必须使用付费的独享 RPC 节点（如 Alchemy Growth Plan），这一点在生产环境通过 .env 配置即可解决，但必须重视。
总结：逻辑通过测试，流程闭环。只要解决了基础设施（付费 RPC）和初始资金配置，这是一套战斗力很强的系统。



1. 真实环境监听逻辑 (The Eyes)
我们在生产环境这套系统的“眼睛”由两部分组成，互为补充：

A. 🐢 区块监听 (Event Listening)

原理：Supervisor 监听 CTF 合约的 TransferSingle 事件。
代码：ctf.on("TransferSingle", handleTransfer)
逻辑：
每当链上有包含 CTF Token 的交易打包上链（Block），事件触发。
Supervisor 检查 from（卖方）或 
to
（买方）是否在我们的 monitoredTraders 列表里。
如果是，立即触发跟单。
特点：绝对可靠，不会漏单，但比该大户的交易慢 1 个区块（约 2 秒）。
B. 🦈 内存池嗅探 (Mempool Sniping - 企业级特性)

原理：Supervisor 通过 WebSocket (ws://...) 监听节点尚未打包的 Pending Transactions。
代码：src/core/mempool-detector.ts
逻辑：
实时捕获全网所有待打包交易。
解码交易数据 (input data)，看是否调用了 safeTransferFrom 或 safeBatchTransferFrom。
如果交易发起者 (from) 是我们监控的大户，立即触发跟单。
优势：理论上能与大户在同一区块甚至在大户之前（如果给更高的 Gas）成交。这就是所谓的“抢跑”。

