# 参与项目系统 (Participation Program) 业务逻辑详解

> 最后更新：2026-03-04
> 版本：v1.0

## 目录

1. [系统概述](#1-系统概述)
2. [核心概念](#2-核心概念)
3. [等级体系](#3-等级体系)
4. [双区促销机制](#4-双区促销机制)
5. [入金渠道与激活](#5-入金渠道与激活)
6. [全托理财系统](#6-全托理财系统)
7. [收益矩阵](#7-收益矩阵)
8. [合作伙伴计划](#8-合作伙伴计划)
9. [奖金机制](#9-奖金机制)
10. [数据库模型](#10-数据库模型)
11. [API 接口](#11-api-接口)
12. [运营流程](#12-运营流程)

---

## 1. 系统概述

参与项目系统是一个多层次的用户激励与合作伙伴计划，结合了：
- **联盟推广 (Affiliate)**：传统多级分销机制
- **双区促销 (Double Zone)**：类似双轨制的晋升机制
- **全托理财 (Managed Wealth)**：用户资金代管理财服务
- **合作伙伴 (Partner)**：高端用户的专属席位计划

### 1.1 系统配置

| 配置项 | 值 |
|--------|-----|
| 规则版本 | 2026-02-25 |
| 入金渠道 | EXCHANGE, TP_WALLET |
| 参与模式 | FREE, MANAGED |
| 策略类型 | CONSERVATIVE, MODERATE, AGGRESSIVE |
| 服务期限 | 1/7/30/90/180/360 天 |
| FREE 最低门槛 | $100 USD |
| MANAGED 最低门槛 | $500 USD |
| 利润分成费率 | 20% |

---

## 2. 核心概念

### 2.1 入金渠道 (Funding Channels)

```typescript
// 支持的入金渠道
PARTICIPATION_FUNDING_CHANNELS = ['EXCHANGE', 'TP_WALLET']

// EXCHANGE: 交易所充值
// TP_WALLET: TP 钱包充值
```

### 2.2 参与模式 (Participation Modes)

| 模式 | 最低门槛 | 资金控制 | 描述 |
|------|---------|---------|------|
| FREE | $100 | 用户自管 | 自主交易模式 |
| MANAGED | $500 | 平台托管 | 全托理财模式 |

### 2.3 策略类型 (Strategy Profiles)

| 策略 | 风险等级 | 预期收益 |
|------|---------|---------|
| CONSERVATIVE | 保守型 | 最低风险，最低收益 |
| MODERATE | 平衡型 | 中等风险，中等收益 |
| AGGRESSIVE | 激进型 | 最高风险，最高收益 |

---

## 3. 等级体系

### 3.1 等级定义

等级根据**团队净入金**（含自己+所有下线）计算：

| 等级 | 最低团队净入金 (USD) | 分红比例 |
|------|---------------------|---------|
| V1   | $100,000           | 30%     |
| V2   | $300,000           | 35%     |
| V3   | $500,000           | 40%     |
| V4   | $1,000,000         | 45%     |
| V5   | $3,000,000         | 50%     |
| V6   | $5,000,000         | 55%     |
| V7   | $10,000,000        | 60%     |
| V8   | $20,000,000        | 65%     |
| V9   | $30,000,000        | 70%     |

### 3.2 净入金计算

```typescript
// 净入金 = 充值金额 - 提现金额
// 支持 USD 和 MCN 等值两种计算方式

NetDeposit = sum(DEPOSIT) - sum(WITHDRAW)
// 同时记录 USD 金额和 MCN 等值金额
```

### 3.3 等级计算逻辑

```
buildParticipationLevelProgress(walletAddresses):
    1. 查找用户 Referrer 记录
    2. 通过 TeamClosure 获取所有下属钱包 (depth >= 0)
    3. 汇总团队净入金 (所有下线)
    4. 根据团队净入金查表确定等级和分红比例
    5. 计算距下一等级差距
```

---

## 4. 双区促销机制

### 4.1 核心概念

双区促销机制将直接下属分为左右两区，以较弱区的金额作为晋升依据：

```
         顶级
           │
      ┌────┴────┐
     /           \
  左区(强区)    右区(弱区)
    $200K        $80K
```

### 4.2 晋升规则

- **弱区金额** = min(左区净入金, 右区净入金)
- 根据弱区金额对照等级表确定晋升等级
- 仅计算直接下属 (depth=1) 的净入金

### 4.3 示例

```
直接下属:
  - A: $200,000
  - B: $80,000
  - C: $50,000

排序后: A($200K) > B($80K) > C($50K)
左区 = A ($200K)
右区 = B ($80K)
弱区 = min($200K, $80K) = $80K

查表: $80K 对应等级?
- 需要 $100,000 才能达到 V1
- 差距: $20,000
```

---

## 5. 入金渠道与激活

### 5.1 激活流程

```
注册 → 入金 → 激活 → 参与
```

1. **注册 (Registration)**
   - 用户创建 ParticipationAccount
   - 状态: PENDING → isRegistrationComplete = true

2. **入金 (Funding)**
   - 通过 EXCHANGE 或 TP_WALLET 渠道入金
   - 创建 ParticipationFundingRecord
   - 更新 NetDepositLedger

3. **激活 (Activation)**
   - 检查入金是否满足最低门槛
   - FREE 模式: ≥ $100
   - MANAGED 模式: ≥ $500
   - 激活后状态: ACTIVATED

### 5.2 入金记录模型

```prisma
model ParticipationFundingRecord {
  id                  String  @id
  accountId           String
  walletAddress       String
  channel             ParticipationFundingChannel  // EXCHANGE | TP_WALLET
  direction           ParticipationFundingDirection // DEPOSIT | WITHDRAW
  tokenSymbol         String  @default("MCN")
  rawAmount           Float
  usdAmount           Float
  mcnEquivalentAmount Float
  txHash              String?
  confirmedAt         DateTime
}
```

---

## 6. 全托理财系统

### 6.1 模式概述

全托理财 (Managed Wealth) 允许用户将资金交给平台代为管理，获取约定的预期收益。

### 6.2 服务期限

| 期限 | 类型 | 描述 |
|------|------|------|
| 1 天 | 试用 | 新用户首次参与可获1天试用 |
| 7 天 | 短期 | 短期理财 |
| 30 天 | 中期 | 标准理财周期 |
| 90 天 | 中长期 | 较长周期 |
| 180 天 | 长期 | 长期理财 |
| 360 天 | 超长期 | 年度理财 |

### 6.3 本金分层 (Principal Bands)

| 分层 | 金额范围 | 适用策略 |
|------|---------|---------|
| Band A | $500 - $5,000 | 入门级 |
| Band B | $5,001 - $50,000 | 中端 |
| Band C | $50,001 - $300,000 | 高端 |

### 6.4 收益矩阵示例

#### Band A ($500-$5,000)

| 期限 | CONSERVATIVE | MODERATE | AGGRESSIVE |
|------|-------------|----------|------------|
| 7 天 | 4%-6% | 7%-11% | 10%-16% |
| 30 天 | 20%-25% | 23%-30% | 26%-35% |
| 90 天 | 70%-100% | 73%-105% | 76%-110% |
| 180 天 | 1.6x-2.1x | 1.63x-2.15x | 1.66x-2.2x |
| 360 天 | 2.5x-3x | 2.53x-3.05x | 2.56x-3.1x |

#### Band C ($50,000-$300,000)

| 期限 | CONSERVATIVE | MODERATE | AGGRESSIVE |
|------|-------------|----------|------------|
| 7 天 | 6%-9% | 9%-14% | 12%-19% |
| 30 天 | 25%-32% | 28%-37% | 31%-42% |
| 90 天 | 95%-135% | 98%-140% | 101%-145% |
| 180 天 | 1.9x-2.6x | 1.93x-2.65x | 1.96x-2.7x |
| 360 天 | 3x-3.8x | 3.03x-3.85x | 3.06x-3.9x |

---

## 7. 合作伙伴计划

### 7.1 席位限制

| 配置项 | 值 |
|--------|-----|
| 最大席位 | 100 |
| 每月淘汰 | 底部 10 席 |
| 退款期限 | 7 天 |
| 默认等级 | V5 |

### 7.2 排名规则

**积分计算**：
```
Score = teamNetDepositUsd + selfNetDepositUsd * 0.000001
```

**排名比较** (降序)：
1. 积分高的优先
2. 积分相同：active managed 金额高的优先
3. 再相同：先加入的优先 (joinedAt 升序)
4. 再相同：钱包地址字典序

**淘汰比较** (升序，即最差的排在前面)：
- 与排名相反顺序

### 7.3 席位生命周期

```
PENDING → ACTIVE → ELIMINATED → REFUND_PENDING → REFUNDED
                      ↓
                 REFUND_FAILED
```

### 7.4 淘汰流程

每月执行一次：

1. **数据快照**
   - 记录当月排名 (PartnerMonthlyRank)
   - 选取积分最低的 10 席

2. **执行淘汰**
   - 创建 PartnerElimination 记录
   - 计算退款截止日期 (eliminatedAt + 7天)
   - 更新席位状态为 ELIMINATED

3. **退款处理**
   - 创建 PartnerRefund 记录
   - 状态: PENDING → COMPLETED/FAILED
   - 超时未退款触发 SLA 告警

### 7.5 席位创建

```typescript
POST /api/partners/seats
{
  walletAddress: "0x...",
  seatFeeUsd?: number,  // 可选，默认使用 refillPriceUsd
  notes?: string
}

// 校验逻辑:
// 1. 钱包地址有效
// 2. 席位未满 (active < maxSeats)
// 3. 座位费匹配配置
// 4. 钱包未被占用 (或已 REFUNDED)
```

---

## 8. 奖金机制

### 8.1 同级奖金 (Same Level Bonus)

当下线产生已实现利润时，上线获得同级奖金：

| 代数 | 奖金比例 |
|------|---------|
| 1 代 | 4% |
| 2 代 | 1% |
| 3+ 代 | 0% |

```typescript
// 计算示例
realizedProfit = $1000
generation = 1
bonus = $1000 * 4% = $40
```

### 8.2 推荐订阅奖金 (Referral Subscription Bonus)

**触发条件**：
- 被推荐人首次合格参与
- 推荐人持有有效的 MANAGED_MEMBERSHIP 或 MANAGED_SUBSCRIPTION

**奖励**：
- 推荐人会员期限延长 **1 天**

**限制**：
- 仅一次，通过 `subscriptionBonusGrantedAt` 防止重复

### 8.3 利润分成

当用户从 MANAGED 模式提现利润时，平台收取 20% 分成：

```typescript
// 费用作用域
PARTICIPATION_PROFIT_FEE_SCOPE = {
  MANAGED_WITHDRAWAL: 'managed-withdraw:',
  PARTICIPATION_WITHDRAWAL: 'participation-withdraw:'
}

// 费率
REALIZED_PROFIT_FEE_RATE = 0.2 // 20%
```

---

## 9. 数据库模型

### 9.1 核心模型关系

```
ParticipationAccount (参与账户)
    │
    ├── ParticipationFundingRecord[] (入金记录)
    ├── NetDepositLedger[] (净入金账本)
    ├── DailyLevelSnapshot[] (每日等级快照)
    ├── DoubleZoneSnapshot[] (每日双区快照)
    └── ManagedCustodyAuthorization[] (托管授权)

PartnerProgramConfig (全局配置)
    └── maxSeats: 100

PartnerSeat (合作伙伴席位)
    ├── PartnerMonthlyRank[] (月度排名)
    ├── PartnerElimination[] (淘汰记录)
    └── PartnerRefund[] (退款记录)

Referrer (推荐人)
    ├── Referral[] (被推荐人)
    ├── TeamClosure[] (层级闭包)
    └── SameLevelBonusSettlement[] (同级奖金)
```

### 9.2 关键模型

#### ParticipationAccount

```prisma
model ParticipationAccount {
  id                   String @id
  walletAddress        String @unique
  status               ParticipationAccountStatus
  preferredMode        ParticipationMode?  // FREE | MANAGED
  isRegistrationComplete Boolean @default(false)
  registrationCompletedAt DateTime?
  activatedAt          DateTime?
}
```

#### PartnerSeat

```prisma
model PartnerSeat {
  id             String @id
  walletAddress  String @unique
  status         PartnerSeatStatus  // ACTIVE | ELIMINATED | REFUND_PENDING | REFUNDED
  seatFeeUsd     Float
  privilegeLevel String @default("V5")  // V1-V9
  backendAccess  Boolean @default(true)
  joinedAt       DateTime
  eliminatedAt   DateTime?
  refundedAt     DateTime?
}
```

#### PartnerElimination

```prisma
model PartnerElimination {
  id                  String @id
  seatId              String
  monthKey            String  // "2026-02"
  rankAtElimination   Int
  scoreNetDepositUsd  Float
  reason              String?
  eliminatedAt        DateTime
  refundDeadlineAt    DateTime  // eliminatedAt + 7天
}
```

---

## 10. API 接口

### 10.1 合作伙伴 API

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/partners/config | 获取全局配置 | Admin |
| POST | /api/partners/config | 更新全局配置 | Admin |
| GET | /api/partners/seats | 获取席位列表 | Admin |
| POST | /api/partners/seats | 创建席位 | Wallet Auth |
| GET | /api/partners/rankings | 获取排名 | Admin |
| POST | /api/partners/cycle/eliminate | 执行月度淘汰 | Admin |
| GET | /api/partners/refunds | 获取退款队列 | Admin |
| POST | /api/partners/refunds | 执行退款 | Admin |
| GET | /api/partners/queue | 获取候补队列 | Admin |
| GET | /api/partners/privileges | 获取用户权限 | Wallet Auth |

### 10.2 参与账户 API

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | /api/participation/account | 获取账户信息 | Wallet Auth |
| POST | /api/participation/account | 创建/激活账户 | Wallet Auth |
| GET | /api/participation/funding | 入金记录 | Wallet Auth |
| POST | /api/participation/funding | 发起入金 | Wallet Auth |
| GET | /api/participation/levels | 等级进度 | Wallet Auth |
| GET | /api/participation/promotion | 双区进度 | Wallet Auth |
| GET | /api/participation/custody-auth | 托管授权 | Wallet Auth |

### 10.3 认证机制

**管理员端点**：
```typescript
// 需要以下 Headers
x-admin-wallet: 0x...        // 管理员钱包地址
x-admin-signature: 0x...      // 签名
x-admin-timestamp: 1234567890 // 时间戳

// 签名验证
message = buildManagedWalletAuthMessage({
  walletAddress,
  method,
  pathWithQuery,
  timestamp
})
```

**用户端点**：
```typescript
// 需要以下 Headers
x-wallet-address: 0x...       // 用户钱包地址
x-wallet-signature: 0x...     // 签名
x-wallet-timestamp: 1234567890 // 时间戳
```

---

## 11. 运营流程

### 11.1 月度淘汰流程

```bash
# 1. 预览淘汰候选
curl -X POST "$BASE_URL/api/partners/cycle/eliminate" \
  -H "x-admin-wallet: $ADMIN" \
  -d '{"monthKey":"2026-02","dryRun":true}'

# 2. 执行淘汰
curl -X POST "$BASE_URL/api/partners/cycle/eliminate" \
  -H "x-admin-wallet: $ADMIN" \
  -d '{"monthKey":"2026-02","dryRun":false,"reason":"monthly-bottom-10"}'

# 3. 执行退款
curl -X POST "$BASE_URL/api/partners/refunds" \
  -H "x-admin-wallet: $ADMIN" \
  -d '{"refundId":"xxx","action":"COMPLETE","txHash":"0x..."}'
```

### 11.2 自动化脚本

```bash
# 每月淘汰触发
npm run partner:eliminate:monthly

# 退款 SLA 监控
npm run verify:partner:refund-sla
```

---

## 12. 政策门控

### 12.1 全托策略门控

```typescript
// 生产环境强制启用
// 非生产环境可通过环境变量控制
MANAGED_POLICY_GATE = process.env.NODE_ENV === 'production' ? true : envValue
```

### 12.2 同级奖金门控

```typescript
// 生产环境默认启用
// 非生产环境需显式启用
PARTICIPATION_ENABLE_SAME_LEVEL_BONUS
```

---

## 附录

### A. 代码位置

| 模块 | 路径 |
|------|------|
| 等级逻辑 | `web/lib/participation-program/levels.ts` |
| 双区促销 | `web/lib/participation-program/promotion.ts` |
| 收益矩阵 | `web/lib/participation-program/rules.ts` |
| 同级奖金 | `web/lib/participation-program/bonuses.ts` |
| 推荐奖金 | `web/lib/participation-program/referral-subscription-bonus.ts` |
| 合作伙伴 | `web/lib/participation-program/partner-program.ts` |
| 运营自动化 | `web/lib/participation-program/partner-ops-automation.ts` |
| 政策门控 | `web/lib/participation-program/policy-gates.ts` |

### B. 数据库表

详见 `web/prisma/schema.prisma` 中的以下模型：
- `ParticipationAccount`
- `ParticipationFundingRecord`
- `NetDepositLedger`
- `DailyLevelSnapshot`
- `DoubleZoneSnapshot`
- `PartnerProgramConfig`
- `PartnerSeat`
- `PartnerMonthlyRank`
- `PartnerElimination`
- `PartnerRefund`
- `PartnerQueue`
