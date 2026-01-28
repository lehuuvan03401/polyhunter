## 1. Implementation
- [x] 1.1 Add schema fields/indexes for execution idempotency and execution metadata (e.g., usedBotFloat).
- [x] 1.2 Add execution guardrails: ENABLE_REAL_TRADING flag, global cap, per-wallet daily cap.
- [x] 1.3 Add pre-execution checks for balance/allowance and clamp SELL sizes.
- [x] 1.4 Add fresh price/quote guard with TTL and slippage validation.
- [x] 1.5 Update worker/execution service to use idempotency key and guardrails.
- [x] 1.6 Add tests/verification scripts for idempotency, guardrails, and pre-checks.
