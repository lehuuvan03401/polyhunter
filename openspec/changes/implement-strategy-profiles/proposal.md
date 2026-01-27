
# Proposal: Implement Multi-Bot Strategy Profiles

## Summary
Add support for "Strategy Profiles" (Conservative, Moderate, Aggressive) to the Copy Trading Proxy Dashboard. This allows users to select different risk/reward configurations for their execution bots, rather than using a single global configuration.

## Motivation
- **User Segmentation**: Different users have different risk appetites.
- **Improved UX**: Simplifies complex parameter tuning into easy-to-understand profiles.
- **Product Value**: justifies "Pro" features by offering sophisticated trading logic.
- **Safety**: "Conservative" profile protects beginners from high slippage/loss.

## Scope
- **Database**: Add `strategyProfile` to `CopyTradingConfig`.
- **Backend**: Update `CopyTradingExecutionService` to apply profile-specific parameters (Max Slippage, Position Sizing, Stop Loss).
- **Frontend**: Update Proxy Dashboard UI to allow selecting a profile.
