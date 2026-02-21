# Fix Copy Trading Critical Issues

## Why

The copy trading system has several critical gaps that prevent reliable operation:

1. **Price fetching disabled** - All orders use hardcoded price 0.5, causing incorrect position sizing
2. **No debt recovery** - Bot float reimbursement failures are only logged, causing capital erosion
3. **No duplicate prevention** - Same events can trigger multiple copies
4. **No position check** - SELL orders don't verify actual token balance
5. **Filters not enforced** - Saved filters like `minLiquidity` are never validated

These issues affect trading accuracy, capital safety, and user trust.

## What

Enable critical trading flow corrections:
- Restore real-time price fetching with caching
- Integrate DebtManager into execution failure paths
- Add event hash deduplication cache
- Query actual CTF balance before SELL operations
- Validate market filters before executing trades

## Scope

### In Scope
- `web/scripts/copy-trading-supervisor.ts` - Event handling, deduplication
- `src/services/copy-trading-execution-service.ts` - Debt logging, balance checks
- Filter validation logic in processJob

### Out of Scope
- EOA/Speed Mode API key generation (requires separate design)
- Take Profit / Stop Loss (requires new PositionWatcher service)
- WebSocket real-time notifications
