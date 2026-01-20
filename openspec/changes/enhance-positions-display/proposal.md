# Proposal: Enhance Positions Display

## Summary
Improve the Positions table in the Portfolio page to provide clearer, more accurate, and actionable information for users tracking simulated copy trading activity.

## Problem Statement
The current Positions display has several issues:
1. **PnL Calculation Bug**: Shows `-100%` when Entry = Current (should be 0%)
2. **Unknown Markets**: Many positions show "Unknown Market" instead of readable titles
3. **Missing Position Status**: No indication of whether position is OPEN, SETTLED, or PENDING
4. **No Estimated Value**: Users cannot see current market value (Size × Current Price)
5. **Unclear Outcomes**: Some outcomes display as "?" instead of proper labels

## Goals
- Fix PnL calculation to handle edge cases (zero price, null values)
- Display human-readable market titles instead of slugs
- Add position status indicator (OPEN, SETTLED_WIN, SETTLED_LOSS)
- Add "Est. Value" column showing current market value
- Improve outcome display with proper badges

## Non-Goals
- Real-time market resolution detection (future enhancement)
- Historical position tracking (covered by Trades tab)

## Success Metrics
- Zero instances of "-100%" PnL when Entry = Current
- 100% of positions show readable market titles
- Users can distinguish between open and settled positions
