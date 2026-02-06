# Findings & Decisions

## Requirements
- Execute optimizations one by one with a clear plan.
- Prioritize safety (no orphan trades / fund loss) and extreme performance.
- Follow OpenSpec proposal workflow before implementation.

## Research Findings
- Recent changes added fire-and-forget execution, optimistic allowance checks, smart buffer reimbursements, and proxy cache; high-safety risks still exist around idempotency and orphan executions.
- Core files: `scripts/copy-trading-worker.ts`, `src/services/copy-trading-execution-service.ts`, `docs/guides/real_trading_architecture.md`.
- OpenSpec specs relevant: `copy-trading` and `copy-execution` (from `openspec list --specs`).
- Project context confirms SDK + worker + contracts architecture; ethers v5 and Polygon RPC constraints apply (`openspec/project.md`).
- Active changes include `optimize-real-copy-trading`, `optimize-execution-engine`, and `add-execution-safety-controls` (from `openspec list`).
- Existing proposals `add-execution-safety-controls` and `add-execution-whitelist-guardrails` already cover app-level pause + worker allowlist guardrails; on-chain contract-level guardrails are not specified.
- Mainnet addresses in `deployed-addresses.json` do not match defaults in `src/core/contracts.ts`, so env overrides are required to avoid address drift.
- Active changes still missing verification: `add-execution-safety-controls` (guardrail events + dry-run) and `fix-copy-trading-logic` (EOA/proxy execution verification).
- `copy-trading` spec includes price TTL=5s, debt logging on reimbursement failure, txHash-based dedup (60s), and pre-sell balance verification requirements.
- `copy-execution` spec requires debt records on float reimbursement failures and periodic recovery.
- Existing change `optimize-real-copy-trading` focuses on WS-based low-latency execution and sim realism; it does not cover idempotency/write-before-execute.
- `copy-trading` spec currently defines Event Deduplication strictly by txHash within 60s; any changes must modify that requirement text directly.
- Existing change `update-real-copy-trading-safety` already proposes DB-level idempotency and guardrails; should reuse/extend instead of duplicating.
- `update-real-copy-trading-safety` tasks are all checked as complete (may be implemented but not archived); proposal already covers idempotency, preflight, guardrails, price TTL, and usedBotFloat persistence.
- `update-real-copy-trading-safety` delta already modified Event Deduplication to enforce DB idempotency and added Pre-Execution Validation + Execution Price Guard; it does not specify pre-write execution ordering.
- `CopyTrade` model already has unique `idempotencyKey`, default `PENDING` status, and unique `(configId, originalTxHash)` indexes, enabling a prewrite-before-execute flow without schema changes.
- Frontend Prisma schema uses config-mode (no datasource url), so Prisma clients must be constructed with adapters (`@prisma/adapter-pg`) rather than default URL-based construction.
- `fix-copy-trading-logic` change proposal is still `draft`; additional optimizations (EOA-specific guardrails/preflight, per-user creds in proxy mode, global circuit breaker) should be added to the change before implementation.
- Supervisor performance bottlenecks: per-subscriber sequential processing, in-memory-only dedup, all-activity WS subscription, and per-trade DB aggregations for guardrails.
- Current `TaskQueue` is in-memory with fixed size (1000) and no durability or backpressure metrics.
- Multi-instance supervisor deployments will double-process without a shared dedup store or sharding.
- `TradingService` mocks market orders and orderbook calls when `chainId` is `1337` or `31337`, enabling local-path verification without hitting CLOB.
- `CopyTradingExecutionService` treats chain IDs `137`, `1337`, and `31337` as polygon for contract addresses, but EOA preflight selects `amoy` addresses whenever `CHAIN_ID !== 137`.
- Proxy execution has a localhost bypass: if `chainId === 1337` and `tokenId` is a non-`0x` string longer than 15 chars, `executeOrderWithProxy` returns mock success before on-chain steps.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Start with idempotency + write-before-execute proposal | Highest safety impact; reduces orphan execution risk |
| Created change `add-copy-trade-prewrite` | Formalizes prewrite-before-execute as a spec change |
| Expire stale PENDING as FAILED | Avoid unsafe auto-retries when execution state is unknown |
| Confirmed `PENDING_EXPIRY_MINUTES = 10` | TTL accepted for stale PENDING expiry |
| Enforce guardrail checks before realtime execution | Aligns worker behavior with guardrail spec |
| Wire debt logging + recovery in worker | Meet copy-execution debt recovery requirements |
| Created change `add-scoped-tx-mutex` | Plan to scope tx serialization per signer |
| Documented debt recovery verification | Provides manual steps for ops validation |
| Created change `add-orderbook-quote-cache` | Adds price quote caching + in-flight dedupe |
| Quote cache TTL capped at 5s | Enforces spec max TTL regardless of env override |
| Created change `add-proxy-execution-queue` | Plan for per-proxy serialization of fund ops |
| Implemented proxy-scoped mutex in execution service | Serializes fund/settlement per proxy |
| Created change `add-preflight-balance-cache` | Plan to cache preflight balance/allowance reads |
| Implemented preflight cache in worker | Short TTL cache reduces RPC load for preflight checks |
| Created change `add-price-fallback` | Plan to add fallback price source when orderbook is missing |
| Implemented price fallback | Uses trade price when orderbook unavailable, with TTL guard |
| Created change `add-execution-tx-monitor` | Plan to wire TxMonitor for stuck tx replacement |
| Implemented execution tx monitor | Tracks on-chain txs and replaces stuck ones |
| Created change `add-cache-eviction` | Plan to bound worker caches with eviction |
| Implemented cache eviction | Bounds quote/preflight caches and prunes on metrics interval |
| Pending: extend `fix-copy-trading-logic` specs | Add EOA-specific guardrails/preflight, per-user creds for proxy mode, and global circuit breaker requirement |
| Updated `fix-copy-trading-logic` delta specs/tasks/design | Formalized EOA guardrails, proxy-mode creds, and global circuit breaker before implementation |
| Implemented EOA-specific preflight + per-user/global limiters | Ensures EOA executes without proxy dependency and respects caps |
| Proxy-mode per-user CLOB creds | Worker uses user TradingService when creds (and key) exist, else falls back |
| Config API redaction | Prevents encrypted secrets from being returned in API responses |
| Planned change `add-contract-execution-guards` | On-chain allowlist + pause + executor binding + address validation |
| Implemented contract execution guards | Proxy execution restricted to owner + bound executor; allowlists enforced in Proxy + Executor |
| Async settlement queue via CopyTrade | SETTLEMENT_PENDING + retry/backoff + metrics; recovery loop handles deferred push/reimburse |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Session-catchup script path missing (CLAUDE_PLUGIN_ROOT unset) | Used local skill templates directory |
| Session-catchup script still unavailable (CLAUDE_PLUGIN_ROOT unset) | Proceeded without session-catchup using existing plan files |
| `openspec show optimize-real-copy-trading --json --deltas-only` failed (missing Why section) | Will inspect change files directly |
| `.env.local` generation concatenated comments onto values | Added trailing newline in `frontend/.env.local.localhost` |
| Verification script failed to init Prisma (adapter missing / Pool export mismatch) | Added adapter fallback with robust module export handling |
| Worker dry-run WS returned 400: "CLOB messages are not supported anymore" | Blocks live-trade validation; needs updated WS/channel config |
| CLOB API key creation failed (400: Could not create api key) | Likely missing/invalid POLY API credentials or wallet permissions |
| Local fork executor rejected txs with `Horus: Unauthorized Worker` | `setup-local-fork.ts` does not whitelist workers; run `contracts/scripts/add-worker.ts` for test wallet |

## Resources
- `scripts/copy-trading-worker.ts`
- `src/services/copy-trading-execution-service.ts`
- `docs/guides/real_trading_architecture.md`
- `openspec/AGENTS.md`
- `openspec/project.md`

## Supervisor Capacity Findings
- 10k users × 10 follows × 5k trades/day implies ~50M copy trades/day (~579/sec avg).
- With 20 workers and 1s exec latency, ~20 trades/sec per instance → ~29 instances avg (58 with 2x headroom).
- At 250ms avg latency, ~80 trades/sec per instance → ~7–8 instances avg (16 with 2x headroom).
- Current supervisor has fixed worker pool size and full-table config refresh, which are bottlenecks at this scale.

## Visual/Browser Findings
- None

## DB Optimization Proposal Prep
- Active DB-related changes already completed: `optimize-db-performance` (async prewrite + config cache) and `implement-data-archiving` (archive tables + script).
- Existing `storage` spec is minimal; new DB requirements should extend `storage` rather than creating a duplicate capability.
- Current config caching is in-memory with TTL 10s, while refresh interval is 60s; this does not materially reduce DB reads under normal operation.
- CopyTrade hot queries in worker include status+time filters (pending expiry, retry scheduling, executed totals) that lack composite indexes today.
- Recovery loops can be double-processed across multiple worker instances; locking/claiming is not modeled in specs yet.
- Decision: single umbrella proposal `optimize-db-design` approved.
- Decision: P1 locking uses `lockedAt/lockedBy` fields (schema-based), not `SKIP LOCKED`.
- Decision: Redis cache adapter deferred; not in this proposal.
- Implemented P0 indexes: CopyTrade (status, expiresAt), (status, nextRetryAt), (status, executedAt) and CommissionLog (referrerId, createdAt).
- EXPLAIN results (local dev data):\n  - Executed totals query uses `CopyTrade_status_executedAt_idx`.\n  - Pending expiry and retry scans still used `CopyTrade_status_idx` with filters (likely due to low data/selectivity).\n  - CommissionLog time-window query used `CommissionLog_referrerId_idx` with createdAt filter (composite index may be favored with more data).
- Implemented P1 locking: `CopyTrade.lockedAt`/`lockedBy` fields + row-claiming in recovery/retry/expiry scans with TTL-based staleness.
- Multi-worker dry-run started successfully, but no `SETTLEMENT_PENDING`/`FAILED` rows were claimed during the short run, so lock-claim behavior remains unobserved.
- Added post-archive maintenance: `scripts/archive-data.ts` now runs `VACUUM (ANALYZE)` on CopyTrade/CommissionLog (can disable via `ARCHIVE_RUN_VACUUM=false`).
- Deferred Redis cache adapter documented in `openspec/changes/optimize-db-design/design.md` for a future proposal.
- Lock-claim verification: parallel claim scripts showed exclusivity (one claimed 2 rows, other 0) using seeded CopyTrade rows.
