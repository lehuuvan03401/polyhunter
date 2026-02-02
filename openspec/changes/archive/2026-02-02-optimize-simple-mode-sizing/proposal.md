# Proposal: Optimize Simple Mode Sizing

## Summary
Change the default copy trading mode in Simple Mode from **Fixed $** to **Range Mode** with proportional sizing, capturing the trader's position sizing signals while protecting users from excessive single-trade exposure.

## Problem Statement
Currently, Simple Mode uses a fixed dollar amount per trade (e.g., $50), regardless of how much the target trader invests. Top traders vary their position sizes based on confidence levels:
- **High confidence trades**: Larger positions ($5,000-$10,000+)
- **Low confidence/exploratory**: Smaller positions ($100-$500)

Using Fixed $ mode causes users to:
1. Miss out on potential gains when traders make high-conviction bets
2. Over-allocate to low-conviction trades relative to the trader's strategy
3. Lose the "signal" that position size provides about trader confidence

## Proposed Solution
Change Simple Mode to use **Range Mode** with the following defaults:
- **Proportional sizing**: 10% of trader's position
- **Minimum per trade**: $5 (avoid dust trades)
- **Maximum per trade**: $100 (risk cap)

This approach:
- ✅ Preserves trader's confidence signal through proportional sizing
- ✅ Protects users from excessive single-trade risk via max cap
- ✅ Ensures meaningful participation via min floor
- ✅ Remains simple for users (just one input: "Amount per Trade" becomes "Max per Trade")

## Changes Required
1. **UI Component**: Update `copy-trader-modal.tsx` Simple Mode section
2. **API Payload**: Adjust default values sent to backend
3. **Backend Logic**: No changes needed (Range mode already supported)

## Impact
- **User Experience**: Minimal change - users still see a simple interface
- **Risk Profile**: Better risk-adjusted returns by following trader's conviction
- **Backwards Compatibility**: Existing configs unchanged; only affects new Simple Mode starts

## Success Metrics
- Users following top traders should see improved correlation with trader returns
- No increase in single-trade losses (protected by max cap)
