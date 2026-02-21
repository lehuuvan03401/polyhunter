# Horus 综合代理系统详解 (Comprehensive Affiliate System)

> **Last Updated**: 2026-02-05  
> **Core Concepts**: Dual-Track (Zero Line + Sun Line), Closure Table, Differential Bonus

这套系统采用了 **双轨制 (Dual-Track)** 设计，结合了传统的层级直推奖励 (Zero Line) 和现代的极差分红机制 (Sun Line)。旨在平衡早期用户的快速裂变动力与团队领导者的长期管理收益。

---

## 1. 核心概念 (Core Concepts)

### A. 零号线 (Zero Line) - 直推爆发
*   **定义**：基于血缘关系的直接推荐网络。
*   **目的**：鼓励用户直接邀请新用户，实现早期用户的快速无脑裂变。
*   **机制**：无论你的职级如何，只要产生了推荐关系，这部分奖励是固定的。覆盖 5 代 (Generation)。

| 代数 (Generation) | 奖励比例 | 描述 |
| :--- | :--- | :--- |
| **Gen 1 (直推)** | **25%** | 只要你邀请人，立刻获得高额回报。 |
| **Gen 2** | 10% | 你的下级邀请的人。 |
| **Gen 3** | 5% | |
| **Gen 4** | 3% | |
| **Gen 5** | 2% | 裂变末端奖励。 |

### B. 太阳线 (Sun Line) - 团队极差
*   **定义**：基于团队整体业绩和职级差额的无限代奖励。
*   **目的**：鼓励培养团队领袖 ("太阳")，奖励深度管理和团队做大。
*   **机制**：**级差制 (Differential Bonus)**。你赚取的是 `你的费率 - 下级费率` 的差额。

#### 职级与费率 (Tiers & Rates)

| 职级 (Rank) | 基础团队费率 (Team Rate) | 晋升要求 (示例) |
| :--- | :--- | :--- |
| **Ordinary** | 1% | 注册即送 |
| **VIP** | 2% | 累计业绩达标 / 直推数达标 |
| **Elite** | 3% | 更高业绩要求 |
| **Partner** | 5% | 团队规模爆发 |
| **Super Partner** | **8%** | 顶级领袖 |

#### 计算逻辑示例
假设你是 **Super Partner (8%)**。
*   你的一条下线（太阳线）领袖是 **Elite (3%)**。
*   该 Elite 团队产生的所有业绩，你都可以提取 **5%** (8% - 3%) 的差额。
*   **平级截断 (Breakaway)**：如果下级通过努力升级为 Super Partner (8%)，极差变为 0。这迫使你不断开辟新的太阳线（横向发展）。

---

## 2. 技术架构实现 (Technical Architecture)

为了支撑这就复杂的 15 代甚至无限代的查询和计算，我们在后端做了深度的架构优化。

### A. 闭包表 (Closure Table)
传统的递归查询 (Recursive Query) 在面临深层级 (如 15 代+) 时性能极差。我们引入了 `TeamClosure` 表：

*   **表结构**:
    *   `ancestorId`: 上级 ID
    *   `descendantId`: 下级 ID
    *   `depth`: 间距 (0=自己, 1=直推, 2=孙子...)
*   **优势**:
    *   查询某人的所有下级 (O(1)): `SELECT * WHERE ancestorId = X`
    *   查询某人的完整上级链路: `SELECT * WHERE descendantId = X`

### B. 佣金引擎 (Affiliate Engine)
核心计算模块位于: `web/lib/services/affiliate-engine.ts`

**计算流程 (每笔交易触发)**:
1.  **Fetch Ancestry**: 一次性拉取交易者的完整上级链 (Ancestry Chain)。
2.  **Zero Line Calc**: 遍历前 5 代上级，分别发放 25%, 10%... 的固定奖励。
3.  **Sun Line Calc**:
    *   从最近的上级开始向上遍历。
    *   维护变量 `maxRatePaid` (当前已发放的最大费率)。
    *   如果 `上级TeamRate > maxRatePaid`，发放差额 `(TeamRate - maxRatePaid)`。
    *   更新 `maxRatePaid`。
    *   直到 `maxRatePaid` 达到 8% 或链条结束。

---

## 3. 用户界面 (Frontend UI)

我们在 `/affiliate` 页面实现了配套的可视化：

*   **团队网络树 (Team Network)**: 直观展示你的下级处于第几代、他们的职级。
*   **模拟器 (Commission Simulator)**: 允许用户输入假设的交易金额，实时演示分配逻辑。
*   **提现系统**: 集成 EIP-712 签名提现流程。

---

## 总结
这套系统不仅仅是一个简单的邀请返佣工具，而是一套完整的自动化营销引擎。零号线负责 "拉新"，太阳线负责 "留存和做大"，配合闭包表技术，能够支撑百万级用户规模的高效运转。