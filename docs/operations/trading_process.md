下面用 “一次真实 BUY 复制单” 的视角，解释完整链路：

✅ 完整交易流程（EOA → Proxy → Bot → Executor → CLOB）
1) EOA（用户主钱包）
只负责：
创建 Proxy
给 Proxy 充值 USDC.e
授权 Executor
关键动作：

EOA → ProxyFactory.createProxy()
EOA → Proxy.approveTrading(Executor)
EOA → Proxy.execute(CTF.setApprovalForAll(Executor))
EOA → Proxy 转入 USDC.e
2) Proxy（用户资金仓库）
真正持有资金和头寸
所有交易资金从 Proxy 出
所有收益/头寸回到 Proxy
3) Bot（执行钱包）
Worker 执行交易的 EOA
被 Executor 授权后，可以替 Proxy 执行交易
自己不持有用户资金（除非 float 模式）
4) Executor（执行中枢）
只允许白名单 Worker 调用
Worker 调用 Executor.executeOnProxy()
Executor 会调用 Proxy 的 execute() 去执行真实动作
5) CLOB / 交易执行
在 CLOB 交易实际发生时：

BUY 的真实执行路径：
Bot → Executor.executeOnProxy(proxy, usdc, transferData)
Executor → Proxy.execute(usdc.transfer(bot, amount))   // Proxy 给 Bot USDC.e
Bot → CLOB 下单 (BUY)
Bot → Executor.executeOnProxy(proxy, CTF.safeTransferFrom(bot → proxy))
SELL 的真实执行路径：
Bot → Executor.executeOnProxy(proxy, CTF.safeTransferFrom(proxy → bot))
Bot → CLOB 下单 (SELL)
Bot → Executor.executeOnProxy(proxy, usdc.transfer(bot → proxy))
✅ 简化图（BUY）
EOA → Proxy(存钱)
Bot → Executor → Proxy.execute(USDC transfer to Bot)
Bot → CLOB 下单 BUY
Bot → Executor → Proxy.execute(CTF transfer to Proxy)
✅ 关键点总结
资金永远属于 Proxy
Bot 只是“代执行者”
Executor 保障 Bot 白名单
CLOB 下单是真实成交点

1) 三个合约的作用
✅ ProxyFactory
作用：创建用户的 Proxy 钱包
对谁负责：每个用户（EOA）都会在这里创建一个专属 Proxy
结果：EOA → Proxy 映射保存在 Factory 里
你用它做什么：

创建 Proxy
查询用户 Proxy 地址
更新代理费率/treasury
✅ Treasury
作用：收取平台费用（利润分成）
对谁负责：所有 Proxy 的手续费结算
你用它做什么：

收到 Proxy 的结算费用
作为平台收入池
✅ Executor
作用：执行交易的“授权中枢”
对谁负责：只允许被白名单授权的 Bot/Worker 调用
你用它做什么：

Worker 通过 Executor 执行 Proxy 上的操作（USDC/CTF）

2) 三者之间的关系
EOA(用户) → ProxyFactory → Proxy(用户钱包)
                      ↘
                       Treasury (收手续费)
                       
Worker/Bot (执行账户) → Executor → Proxy
简化理解：

ProxyFactory 负责“发 Proxy”
Proxy 负责“存资产 + 执行交易”
Executor 负责“只允许授权 Bot 代执行”
Treasury 负责“收手续费”

是一个普通钱包（EOA）
只负责“发交易”和“链上执行”
必须被 Executor 白名单允许
✅ PROXY（用户资金仓库）
是合约钱包，里面放资金（USDC.e）
真正持有头寸和资产
所有收益/成本都在 Proxy
✅ Executor
是合约，只允许白名单 Bot 调用
负责把 Bot 的指令转发给 Proxy
不持有资金，只负责“授权转发”