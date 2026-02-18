我们假设我们正在设计一个多级分销系统的团队结构模型，我们将定义两种关键的团队线：零号线和太阳线。
规则描述将结构化，以便于AI编程工具理解，可能用于生成团队网络、计算奖金等。

定义：

零号线（Direct Line）：指由某个成员直接推荐的所有成员组成的集合。在组织树中，这些成员是该节点的直接子节点。

太阳线（Sun Line）：指由某个成员的零号线成员（即直接推荐成员）中，那些自身又发展了庞大团队的成员所形成的分支。实际上，太阳线是零号线中那些成为团队领袖的成员所带领的整个团队。

但是，在程序实现中，我们通常不直接存储“太阳线”这个概念，而是通过计算某个下级团队的深度和广度来识别。因此，我们更关注的是团队的结构和绩效。

为了便于开发，我们可以定义以下规则和计算方式：

一、团队结构规则：

每个成员有一个唯一的ID（uid）和一个推荐人ID（sponsor_id）。

整个团队构成一棵树，根节点是创始人（sponsor_id为null或0）。

零号线：对于成员X，其零号线是直接推荐人ID为X的所有成员（即直接子节点）。

二、太阳线的识别规则：

太阳线是零号线中那些对团队整体业绩（如下级人数、销售业绩等）有显著贡献的成员所带领的子树。

我们可以设定一个阈值来定义什么是“显著贡献”，例如：

下级团队人数超过N人。

团队业绩达到一定数额。

或者该成员本身达到了某个职级（如经理、总监等）。

三、快速发展的机制（在计算奖金或团队激励时）：

奖金制度设计：通常，零号线的业绩直接贡献于上级的直接推广奖金（直推奖），而太阳线的业绩则可能贡献于上级的管理奖金（间推奖、领导奖等）。

为了鼓励快速发展，奖金制度会奖励那些培育出太阳线的成员。例如，当零号线中的某个成员成为了一个太阳线（即他的团队达到一定规模），那么上级可以从该太阳线的整体业绩中获得一定比例的领导奖金。

四、为AI编程工具提供的规则描述（数据结构与算法方向）：

假设我们有以下数据结构：

成员表（member）：
uid, sponsor_id, join_time, level (职级), personal_sales (个人销售业绩) 等。

团队关系表（team_structure）：
我们可以通过递归查询（或使用闭包表）来获取某个成员的所有下级。

规则1：零号线的获取
SELECT * FROM member WHERE sponsor_id = X; -- X的零号线

规则2：太阳线的识别（假设以团队人数为阈值）
步骤：

获取X的零号线成员列表L。

对于L中的每一个成员M，计算M的团队总人数（包括M自己，或者不包括，根据制度定义）。

如果M的团队总人数 >= 阈值K，则M就是X的一个太阳线领袖，M及其团队就是X的一条太阳线。

规则3：计算X的团队总人数（包括所有下级）
可以使用递归查询或闭包表。例如，闭包表结构（team_closure）：
ancestor (上级), descendant (下级), depth (深度，0表示自己)
那么，X的团队总人数（包括自己）为：
SELECT COUNT(DISTINCT descendant) FROM team_closure WHERE ancestor = X;

规则4：计算X从太阳线获得的领导奖金（示例）
假设制度：对于每个太阳线领袖M，X可以从M的团队总业绩中获得一定比例（如a%）的奖金，但可能只计算M的团队中深度为1以下的部分（即不包括M自己，因为M自己的业绩可能已经通过直推奖计算过了）。

则计算方式：
对于每个太阳线领袖M：
获取M的团队总业绩（不包括M自己）：
SELECT SUM(personal_sales) FROM member
WHERE uid IN (SELECT descendant FROM team_closure WHERE ancestor = M AND depth >= 1)
然后，X从这条太阳线获得的奖金 = 上述业绩 * a%。

注意：实际的奖金计算可能更复杂，可能涉及不同职级的不同比例、按照级差计算等，但以上给出了一个简单的示例。

五、快速发展的原因在规则中的体现：

规则鼓励成员发展零号线，因为零号线是直接贡献直推奖的。

规则更鼓励成员将零号线中的成员培养成太阳线，因为太阳线可以带来持续的领导奖金，而且太阳线可以自我裂变，实现团队的自动化增长。

六、给AI的开发提示：
在开发时，我们需要：
1. 设计数据库表结构，能够高效地存储和查询团队关系（如使用闭包表）。
2. 根据业务规则，编写存储过程或函数来计算零号线、太阳线以及相关奖金。
3. 注意性能，因为团队关系可能非常深和广，递归查询可能效率低下，可以考虑使用闭包表或者定期快照。

下面是一个闭包表的例子：

表：team_closure
ancestor (bigint) - 祖先ID
descendant (bigint) - 后代ID
depth (int) - 祖先到后代的深度（0表示自己）

示例：如果A推荐了B，B推荐了C，那么：
(A, A, 0)
(A, B, 1)
(A, C, 2)
(B, B, 0)
(B, C, 1)
(C, C, 0)

这样，要查询A的所有下级（包括自己）：
SELECT descendant FROM team_closure WHERE ancestor = A;

要查询A的所有直接推荐（零号线）：
SELECT descendant FROM team_closure WHERE ancestor = A AND depth = 1;

要查询A的太阳线（假设太阳线领袖的定义是团队人数超过100人）：
SELECT M.uid, COUNT(T.descendant) as team_count
FROM member M
JOIN team_closure T ON T.ancestor = M.uid
WHERE M.sponsor_id = A -- A的零号线
GROUP BY M.uid
HAVING team_count >= 100;

注意：这里团队人数包括了他自己，所以实际上阈值100包括了他自己。如果不想包括自己，可以改为 COUNT(T.descendant) - 1 >= 100。

以上是一个简化的规则描述，实际项目中需要根据具体的业务需求进行调整。



# 零号线与太阳线规则定义（AI编程规范）

## 一、数据结构定义

```json
{
  "团队系统": {
    "数据结构": {
      "Member": {
        "id": "string | number",  // 成员唯一标识
        "parent_id": "string | number | null",  // 推荐人ID（上级）
        "direct_line_members": "Member[]",  // 零号线成员数组
        "sun_lines": "SunLine[]",  // 太阳线数组
        "level": "number",  // 职级/层级
        "personal_performance": "number",  // 个人业绩
        "team_performance": "number",  // 团队总业绩
        "join_time": "datetime",
        "is_sun_line_leader": "boolean"  // 是否为太阳线领袖
      },
      
      "SunLine": {
        "sun_leader_id": "string | number",  // 太阳线领袖ID
        "total_members": "number",  // 该太阳线总人数
        "total_performance": "number",  // 该太阳线总业绩
        "depth": "number",  // 太阳线深度（层级）
        "breadth": "number",  // 太阳线宽度（直接下级数）
        "activation_time": "datetime"  // 成为太阳线时间
      }
    }
  }
}
```

## 二、核心规则定义

### 规则1：零号线识别规则
```javascript
// 输入：当前成员ID
// 输出：该成员的零号线成员列表
function identifyZeroLine(currentMemberId) {
  return {
    rule_name: "zero_line_identification",
    conditions: [
      "member.parent_id === currentMemberId",  // 直接条件
      "member.join_time > currentMember.activation_time",  // 加入时间晚于当前成员激活时间
      "member.status === 'active'"  // 状态为活跃
    ],
    calculation_logic: {
      method: "direct_query",
      parameters: {
        "max_depth": 1,  // 只取第一代
        "include_inactive": false,
        "performance_threshold": 0  // 业绩门槛（可配置）
      }
    },
    output_structure: {
      "zero_line_count": "number",
      "zero_line_members": "Array<Member>",
      "average_performance": "number"
    }
  };
}
```

### 规则2：太阳线判定规则
```javascript
function identifySunLines(memberId) {
  return {
    rule_name: "sun_line_identification",
    prerequisites: [
      "member.level >= required_level",  // 达到指定职级
      "member.zero_line_count >= min_zero_line_members",  // 拥有足够零号线成员
      "member.team_performance >= threshold_performance"  // 团队业绩达标
    ],
    
    // 判定条件（满足任意一条即可判定为太阳线）
    conditions: {
      "or_conditions": [
        {
          "name": "team_size_condition",
          "logic": "subordinate_count >= config.sun_line.min_team_size",
          "config_value": 50  // 默认团队人数≥50
        },
        {
          "name": "performance_condition",
          "logic": "team_performance >= config.sun_line.min_team_performance",
          "config_value": 100000  // 默认团队业绩≥100000
        },
        {
          "name": "depth_condition",
          "logic": "team_depth >= config.sun_line.min_team_depth",
          "config_value": 5  // 默认团队层级≥5
        },
        {
          "name": "leader_level_condition",
          "logic": "leader_level >= config.sun_line.min_leader_level",
          "config_value": 3  // 默认领袖职级≥3
        }
      ]
    },
    
    // 权重计算（用于太阳线强度评估）
    weight_calculation: {
      "team_size_weight": 0.3,
      "performance_weight": 0.4,
      "depth_weight": 0.2,
      "stability_weight": 0.1,
      "calculation_formula": "sum(weight * normalized_value)"
    }
  };
}
```

## 三、发展激励机制规则

### 规则3：快速裂变奖励规则
```javascript
function rapidDevelopmentIncentives() {
  return {
    rule_set: "growth_incentives",
    
    // 零号线发展激励
    zero_line_incentives: {
      "direct_recruitment_bonus": {
        "conditions": ["new_member.parent_id === current_member.id"],
        "bonus_type": "fixed_amount | percentage",
        "calculation": "config.bonus.direct_recruit * new_member.initial_purchase"
      },
      "quick_start_bonus": {
        "conditions": [
          "time_since_join <= 30 days",
          "zero_line_count >= 5"
        ],
        "bonus_type": "ladder_bonus",
        "ladder_levels": [
          {"count": 5, "bonus": 500},
          {"count": 10, "bonus": 1200},
          {"count": 20, "bonus": 3000}
        ]
      }
    },
    
    // 太阳线培育激励
    sun_line_incentives: {
      "sun_line_creation_bonus": {
        "trigger": "member.zero_line_member qualifies as sun_line",
        "bonus_calculation": "config.bonus.sun_line_creation * sun_line_initial_performance"
      },
      "leadership_royalty": {
        "type": "recurring_percentage",
        "source": "sun_line_total_performance",
        "percentage": "config.royalty.percentage[member.level]",
        "payment_frequency": "monthly"
      },
      "sustainability_bonus": {
        "conditions": [
          "sun_line_active_months >= 6",
          "sun_line_growth_rate >= 0.1"
        ],
        "bonus": "config.bonus.sustainability * sun_line_performance"
      }
    },
    
    // 双线协同激励
    synergy_incentives: {
      "dual_line_development_bonus": {
        "conditions": [
          "zero_line_count >= config.thresholds.zero_line",
          "sun_line_count >= config.thresholds.sun_line"
        ],
        "multiplier": "1 + (sun_line_count * config.multipliers.per_sun_line)"
      }
    }
  };
}
```

## 四、团队结构计算算法

### 算法1：太阳线识别算法
```python
"""
太阳线识别算法（伪代码）
输入：团队树结构，当前节点ID
输出：太阳线列表及属性
"""
class SunLineIdentifier:
    def __init__(self, config):
        self.min_team_size = config['min_team_size']
        self.min_depth = config['min_depth']
        self.min_performance = config['min_performance']
    
    def find_sun_lines(self, root_member):
        sun_lines = []
        
        # 遍历零号线成员
        for direct_member in root_member.zero_line_members:
            # 计算该成员的团队规模
            team_stats = self.calculate_team_stats(direct_member)
            
            # 判定是否为太阳线
            if self.is_sun_line(team_stats):
                sun_line = self.build_sun_line_object(direct_member, team_stats)
                sun_lines.append(sun_line)
        
        return sun_lines
    
    def calculate_team_stats(self, member):
        return {
            'total_members': self.count_team_members(member),
            'total_performance': self.sum_team_performance(member),
            'max_depth': self.calculate_max_depth(member),
            'direct_subordinates': len(member.zero_line_members)
        }
    
    def is_sun_line(self, stats):
        # 多条件判定逻辑
        conditions = [
            stats['total_members'] >= self.min_team_size,
            stats['max_depth'] >= self.min_depth,
            stats['total_performance'] >= self.min_performance
        ]
        
        # 至少满足两个条件
        return sum(conditions) >= 2
```

### 算法2：裂变速度计算
```python
class GrowthSpeedCalculator:
    def calculate_growth_rate(self, member, period_days=30):
        """
        计算团队裂变速度
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period_days)
        
        # 计算新增成员
        new_members = self.get_new_members_in_period(member, start_date, end_date)
        
        # 计算裂变系数
        fission_coefficient = self.calculate_fission_coefficient(member, new_members)
        
        # 计算太阳线贡献度
        sun_line_contribution = self.calculate_sun_line_contribution(member)
        
        return {
            'new_members_count': len(new_members),
            'fission_coefficient': fission_coefficient,
            'sun_line_contribution_ratio': sun_line_contribution,
            'projected_growth': self.project_future_growth(fission_coefficient, sun_line_contribution)
        }
    
    def calculate_fission_coefficient(self, member, new_members):
        """
        裂变系数 = (直接推荐数 + 间接推荐数 × 权重) / 时间段
        """
        direct_recruits = len([m for m in new_members if m.parent_id == member.id])
        indirect_recruits = len(new_members) - direct_recruits
        
        return (direct_recruits + indirect_recruits * 0.5) / len(new_members) if new_members else 0
```

## 五、配置参数示例

```yaml
# 系统配置参数
system_config:
  zero_line:
    identification:
      max_depth: 1
      performance_threshold: 0
      time_window_days: 90
    
    incentives:
      direct_recruit_bonus_rate: 0.1  # 10%
      quick_start_bonus_threshold: 5
      quick_start_bonus_amounts: [500, 1200, 3000]
  
  sun_line:
    qualification_thresholds:
      min_team_size: 50
      min_team_performance: 100000
      min_team_depth: 5
      min_leader_level: 3
    
    incentives:
      creation_bonus_rate: 0.05  # 5%
      royalty_percentages:  # 按职级划分
        level_1: 0.01
        level_2: 0.02
        level_3: 0.03
        level_4: 0.04
        level_5: 0.05
      
      sustainability_bonus:
        min_active_months: 6
        min_growth_rate: 0.1
        bonus_rate: 0.02
  
  growth_metrics:
    fast_track_thresholds:
      zero_line_goal_30days: 10
      sun_line_goal_90days: 1
      performance_goal_30days: 50000
    
    acceleration_factors:
      sun_line_multiplier: 1.5
      dual_line_bonus_multiplier: 2.0
      team_depth_factor: 0.1  # 每层深度加成
```

## 六、API接口规范

```javascript
// API端点定义
const endpoints = {
  // 获取零号线信息
  GET '/api/member/{id}/zero-line': {
    description: "获取成员的零号线成员列表",
    parameters: {
      include_performance: "boolean",
      include_sun_line_candidates: "boolean",
      max_results: "number"
    },
    response: {
      zero_line_count: "number",
      members: "Member[]",
      statistics: {
        total_performance: "number",
        average_performance: "number",
        growth_rate: "number"
      }
    }
  },
  
  // 获取太阳线信息
  GET '/api/member/{id}/sun-lines': {
    description: "获取成员培育的太阳线",
    parameters: {
      min_team_size: "number",
      min_performance: "number",
      active_only: "boolean"
    },
    response: {
      sun_line_count: "number",
      sun_lines: "SunLine[]",
      total_contribution: "number",
      growth_trend: "object"
    }
  },
  
  // 计算发展潜力
  POST '/api/growth/potential-calculation': {
    description: "计算成员的发展潜力和速度预测",
    request_body: {
      member_id: "string",
      time_period_days: "number",
      include_scenarios: "boolean"
    },
    response: {
      current_growth_rate: "number",
      projected_growth: {
        conservative: "number",
        moderate: "number",
        aggressive: "number"
      },
      key_factors: {
        zero_line_quality: "number",
        sun_line_potential: "number",
        network_strength: "number"
      },
      recommendations: "string[]"
    }
  }
};
```

## 七、使用示例

```javascript
// 示例：识别并计算太阳线
const teamSystem = new TeamDevelopmentSystem(config);

// 1. 识别零号线
const zeroLine = teamSystem.getZeroLine(memberId);
console.log(`零号线成员数: ${zeroLine.count}`);

// 2. 识别太阳线
const sunLines = teamSystem.identifySunLines(memberId);
sunLines.forEach(sunLine => {
  console.log(`太阳线领袖: ${sunLine.leaderId}, 团队规模: ${sunLine.teamSize}`);
});

// 3. 计算发展速度
const growthMetrics = teamSystem.calculateGrowthSpeed(memberId, 30);
console.log(`30天裂变系数: ${growthMetrics.fissionCoefficient}`);

// 4. 计算激励奖金
const incentives = teamSystem.calculateIncentives(memberId);
console.log(`总激励奖金: ${incentives.totalBonus}`);
```

此规则定义提供了完整的可编程规范，包括数据结构、判定逻辑、计算算法和API接口，可直接用于开发团队裂变系统。