# Design: Scientific Trader Scoring System

## Context

Copy trading users need to identify traders who will generate consistent profits when followed. The current scoring system is too simplistic and can lead users to follow high-risk traders who may have lucky streaks rather than genuine skill.

**Stakeholders**: Copy traders (followers), platform operators

**Constraints**:
- Must work with available Polymarket data (positions, activities, leaderboard)
- Performance impact: scoring should not significantly slow down API responses
- Backward compatibility: existing UI should continue to work during transition

## Goals / Non-Goals

### Goals
- Implement risk-adjusted performance metrics
- Calculate meaningful win rate using closed trade data
- Assess copy-friendliness of traders
- Provide clear, understandable scores for users

### Non-Goals
- Machine learning-based predictions
- Real-time streaming score updates
- Historical backtesting engine

## Decisions

### Decision 1: Scoring Algorithm Weights

**Chosen Approach**: Weighted multi-factor scoring with the following distribution:

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Risk-Adjusted Return (Sharpe-like) | 25% | Core performance indicator |
| Profit Factor | 20% | Profitability consistency |
| Max Drawdown (inverted) | 15% | Risk tolerance |
| Volume-Weighted Win Rate | 15% | Trading skill measure |
| Activity Score | 10% | Ensures active traders |
| Copy-Friendliness | 15% | Practical copy trading success |

**Alternatives Considered**:
- Equal weighting (10% each) - rejected: doesn't prioritize what matters most
- PnL-only ranking - rejected: current system, proven insufficient
- ML-based scoring - rejected: overkill for MVP, needs training data

### Decision 2: Metric Calculation Methods

**Sharpe-like Ratio**:
```
SR = (avgDailyReturn - 0) / stdDevDailyReturn
```
Note: We use 0 as risk-free rate since crypto has no risk-free benchmark.

**Profit Factor**:
```
PF = totalGrossProfit / |totalGrossLoss|
```
Values > 2.0 indicate strong profitability.

**Volume-Weighted Win Rate**:
```
VWWR = sumProfitableTradeValue / sumAllTradeValue
```
Better than simple win count as it accounts for trade size.

**Copy-Friendliness Score**:
- Penalize very large orders (harder to fill at same price)
- Penalize very fast execution clusters (hard to follow)
- Reward traders with diverse, moderate-sized positions

### Decision 3: Data Aggregation Period

**Chosen**: Rolling 30-day window with exponential decay (recent trades weighted more)

**Rationale**: 
- 7 days too short for statistical significance
- 90 days may include outdated patterns
- Exponential decay ensures recent performance matters more

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| API latency increase | Medium | Cache computed scores for 5 minutes |
| Data gaps in activity history | Low | Graceful fallback to simpler metrics when data insufficient |
| Gaming the algorithm | Medium | Use multiple uncorrelated factors; monitor for anomalies |
| User confusion | Medium | Clear tooltips explaining each metric |

## Migration Plan

1. **Phase 1**: Add new scoring service without UI changes (collect data)
2. **Phase 2**: Add new columns to leaderboard tables
3. **Phase 3**: Make new score the default sort order
4. **Rollback**: Feature flag to revert to old scoring instantly

## Open Questions

1. Should we show negative scores or floor at 0?
2. Minimum trade count before showing a score (to avoid noise)?
3. Should copy-friendliness factor in market liquidity?
