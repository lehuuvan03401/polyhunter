# Verification Notes: Forced Fallback Price

## Manual Checks
- Run worker with `COPY_TRADING_FORCE_FALLBACK_PRICE=true`.
- Trigger a trade signal.
- Expect log: `Forced fallback price for <tokenId> (trade)`.
- Metrics summary should show `Price Source: ... fallback>0`.

## Expected Outcome
- Orderbook fetch is skipped and fallback price is used when enabled.
- Default behavior unchanged when flag is false.
