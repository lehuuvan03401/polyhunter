## 1. Implementation
- [x] 1.1 Add side-aware filter market metrics resolver with TTL cache.
- [x] 1.2 Enforce `minLiquidity` using orderbook depth (fallback Gamma liquidity).
- [x] 1.3 Enforce `minVolume` using Gamma 24h volume (fallback total volume).
- [x] 1.4 Fail filter evaluation when configured thresholds require unavailable metrics.

## 2. Verification
- [x] 2.1 Run web type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
