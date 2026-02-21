# Verification Notes: Price Fallback

## Manual Checks
- Orderbook missing:
  - Simulate orderbook failure (network block or invalid token).
  - Expect log: `Orderbook unavailable, using fallback price (trade)`.
  - Execution should proceed if fallback within TTL and slippage bounds.

- TTL enforcement:
  - Use a trade timestamp older than 5s.
  - Expect fallback rejected and price guard error.

## Expected Outcome
- Fallback used only when orderbook quote is unavailable.
- TTL and slippage guards still enforced.
