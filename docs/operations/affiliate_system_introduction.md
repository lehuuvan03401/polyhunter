Horus 综合代理系统详解 (Comprehensive Affiliate System)
这套系统采用了双轨制（Dual-Track）设计，结合了传统的层级直推奖励（Zero Line）和现代的极差分红机制（Sun Line）。旨在平衡早期用户的快速裂变动力与团队领导者的长期管理收益。

以下是系统的核心逻辑与技术实现详解：

1. 核心概念 (Core Concepts)
A. 零号线 (Zero Line) - 直推爆发
定义：基于血缘关系的直接推荐网络。
目的：鼓励用户直接邀请新用户，实现早期用户的快速无脑裂变。
奖励机制：固定层级比例，覆盖 5 代（Generation）。
1代 (直推): 25% (最高) - 只要你就邀请人，立刻获得高额回报。
2代: 10%
3代: 5%
4代: 3%
5代: 2%
特点：无论你的职级如何，只要产生了推荐关系，这部分奖励是固定的。
B. 太阳线 (Sun Line) - 团队极差
定义：基于团队整体业绩和职级差额的无限代奖励。
目的：鼓励培养团队领袖（"太阳"），奖励深度管理和团队做大。
奖励机制：级差制 (Differential Bonus)。你赚取的是你的费率 - 下级费率的差额。
职级与费率 (Tiers & Rates)：
职级 (Rank)	基础团队费率 (Team Rate)	晋升要求 (示例)
Ordinary	1%	注册即送
VIP	2%	累计业绩达标 / 直推数达标
Elite	3%	更高业绩要求
Partner	5%	团队规模爆发
Super Partner	8%	顶级领袖
计算逻辑：
假设你是 Super Partner (8%)。
你的一条下线（太阳线）领袖是 Elite (3%)。
该 Elite 团队产生的所有业绩，你都可以提取 5% (8% - 3%) 的差额。
注意：如果下级通过努力平级甚至超越你的职级，这部分的极差就会变为 0，这被称为"平级截断"（Breakaway），迫使你不断开辟新的太阳线（横向发展）。
2. 技术架构实现 (Technical Architecture)
为了支撑这就复杂的 15 代甚至无限代的查询和计算，我们在后端做了深度的架构优化：

A. 闭包表 (Closure Table) - TeamClosure
传统的递归查询（Recursive Query）在面临深层级（如 15 代+）时性能极差。我们引入了闭包表设计：

结构：存储网络中任意两个有上下级关系的节点。
ancestorId: 上级 ID
descendantId: 下级 ID
depth: 间距 (0=自己, 1=直推, 2=孙子...)
优势：
查询某人的所有下级（包含第 100 代）：SELECT * WHERE ancestorId = X (O(1) 复杂度)。
查询某人的完整上级链路：SELECT * WHERE descendantId = X。
B. 佣金引擎 (Affiliate Engine)
位于 
frontend/lib/services/affiliate-engine.ts
 的核心计算模块。

触发时机：每一笔交易发生时 (Trade Executed)。
计算流程：
获取链路：一次性拉取交易者的完整上级链（Ancestry Chain）。
零号线计算：遍历前 5 代上级，分别发放 25%, 10%... 的固定奖励。
太阳线计算：
从最近的上级开始向上遍历。
维护一个变量 maxRatePaid（当前已发放的最大费率）。
如果上级的 TeamRate > maxRatePaid，则发放差额 
(TeamRate - maxRatePaid)
。
更新 maxRatePaid = TeamRate。
直到 maxRatePaid 达到 8% (Super Partner) 或链条结束，计算停止。
3. 用户界面 (Frontend UI)
我们在 /affiliate页面实现了配套的可视化：

团队网络树 (Team Network)：直观展示你的下级处于第几代、他们的职级以及为你贡献的业绩。
模拟器 (Commission Simulator)：允许用户输入假设的交易金额，系统会实时演示这笔交易会如何根据当前的规则分配给上级，这对于理解复杂的极差逻辑非常有帮助。
总结
这套系统不仅仅是一个简单的邀请返佣工具，而是一套完整的自动化营销引擎。零号线负责"拉新"，太阳线负责"留存和做大"，配合闭包表技术，能够支撑百万级用户规模的高效运转。