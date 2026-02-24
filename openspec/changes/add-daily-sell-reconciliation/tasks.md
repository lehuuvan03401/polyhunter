## 1. Implementation
- [x] 1.1 Expose fill lookup utility from TradingService for reconciliation usage.
- [x] 1.2 Add supervisor reconciliation job (scheduled) for recent SELL trades.
- [x] 1.3 Persist reconciliation corrections and audit events when mismatch exceeds threshold.
- [x] 1.4 Ensure new trades preserve order identifier fallback for future reconciliation coverage.

## 2. Verification
- [x] 2.1 Run SDK build/type-check.
- [x] 2.2 Run web type-check.
- [x] 2.3 Validate OpenSpec change with strict mode.
