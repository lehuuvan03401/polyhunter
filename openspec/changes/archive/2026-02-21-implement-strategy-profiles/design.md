
# Design: Strategy Profiles Architecture

## Data Model

### `CopyTradingConfig` (Prisma Update)
Add a new field `strategyProfile` to the `CopyTradingConfig` model.

```prisma
enum StrategyProfile {
  CONSERVATIVE
  MODERATE
  AGGRESSIVE
}

model CopyTradingConfig {
  // ... existing fields
  strategyProfile StrategyProfile @default(MODERATE)
}
```

## Strategy Definitions

We will define a configuration map in code that translates the `StrategyProfile` enum into concrete execution parameters.

| Parameter | Conservative | Moderate | Aggressive |
| :--- | :--- | :--- | :--- |
| **Max Slippage** | 0.5% | 1.0% | 5.0% |
| **Position Sizing** | Fixed (e.g. $10) or Low % | Standard % | High % / Leverage |
| **Gas Priority** | Normal | Fast | Instant |
| **Stop Loss** | 10% | 30% | 100% (None) |

## Execution Logic Flow

1. **Worker** receives trade signal.
2. **Worker** looks up `CopyTradingConfig` for the user.
3. **Worker** reads `strategyProfile`.
4. **Worker** fetches parameters for that profile from the `STRATEGY_CONFIGS` constant.
5. **ExecutionService** uses these dynamic parameters for `maxSlippage`, `gasOverrides`, etc.

## UI / UX

- **Location**: Proxy Dashboard -> Bot Authorization card.
- **Interaction**: Carousel or Button Group to select profile.
- **Visuals**: Distinct icons/colors for each profile (Shield for Conservative, Scale for Moderate, Rocket for Aggressive).
