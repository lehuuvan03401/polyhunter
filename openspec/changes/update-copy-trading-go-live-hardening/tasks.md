## 1. Security Baseline (P0)
- [x] 1.1 Enforce production signature validation for wallet-scoped copy-trading APIs, with explicit non-production-only test bypass.
- [x] 1.2 Enforce authenticated cron access for `/api/copy-trading/detect` and remove insecure default `CRON_SECRET` fallback.
- [x] 1.3 Restrict `/api/copy-trading/redeem-sim` to authenticated owner requests and explicit simulation mode gates.
- [x] 1.4 Add startup configuration validation that fails closed when `ENCRYPTION_KEY`/`CRON_SECRET` are missing, invalid, or placeholder values.

## 2. Execution Consistency and Idempotency (P0)
- [x] 2.1 Add atomic claim semantics for pending trades (`PENDING -> PROCESSING/locked`) so only one executor can run a trade.
- [x] 2.2 Make execute finalization single-path and deterministic (`EXECUTED`, `SETTLEMENT_PENDING`, `FAILED`, `SKIPPED`).
- [x] 2.3 Fix orchestrator success classification so EOA success (orderId without tx hash) is treated as executed.
- [x] 2.4 Add exception-safe terminalization so failures after trade creation cannot leave orphan `PENDING` records.
- [x] 2.5 Persist and use stable `originalTxHash` identity in detect flow; dedupe by `(configId, originalTxHash)` rather than time/float heuristics.

## 3. Capacity and Runtime Safety (P1)
- [x] 3.1 Add hard pagination caps and cursor-based paging for high-cardinality copy-trading read APIs.
- [x] 3.2 Add bounded-size + sweep policies to shared TTL caches and supervisor in-memory maps.
- [x] 3.3 Ensure guardrail counters use atomic store semantics under concurrency and sharding.
- [x] 3.4 Normalize supervisor/API env contracts (`CHAIN_ID`, `DRY_RUN`, signature flags) and fail fast on conflicting configuration.

## 4. Verification and Rollout Readiness
- [x] 4.1 Add concurrency tests for execute-claim race (parallel requests against one pending trade).
- [x] 4.2 Add idempotency tests for duplicate signals across WebSocket/polling/chain sources.
- [x] 4.3 Add security tests for fail-closed auth/secret/key behavior in production mode.
- [x] 4.4 Add performance regression checks for bounded cache growth and capped query cost.
- [x] 4.5 Run `openspec validate update-copy-trading-go-live-hardening --strict --no-interactive`.
