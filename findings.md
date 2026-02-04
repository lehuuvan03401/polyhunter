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
- `copy-trading` spec includes price TTL=5s, debt logging on reimbursement failure, txHash-based dedup (60s), and pre-sell balance verification requirements.
- `copy-execution` spec requires debt records on float reimbursement failures and periodic recovery.
- Existing change `optimize-real-copy-trading` focuses on WS-based low-latency execution and sim realism; it does not cover idempotency/write-before-execute.
- `copy-trading` spec currently defines Event Deduplication strictly by txHash within 60s; any changes must modify that requirement text directly.
- Existing change `update-real-copy-trading-safety` already proposes DB-level idempotency and guardrails; should reuse/extend instead of duplicating.
- `update-real-copy-trading-safety` tasks are all checked as complete (may be implemented but not archived); proposal already covers idempotency, preflight, guardrails, price TTL, and usedBotFloat persistence.
- `update-real-copy-trading-safety` delta already modified Event Deduplication to enforce DB idempotency and added Pre-Execution Validation + Execution Price Guard; it does not specify pre-write execution ordering.
- `CopyTrade` model already has unique `idempotencyKey`, default `PENDING` status, and unique `(configId, originalTxHash)` indexes, enabling a prewrite-before-execute flow without schema changes.

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

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Session-catchup script path missing (CLAUDE_PLUGIN_ROOT unset) | Used local skill templates directory |
| `openspec show optimize-real-copy-trading --json --deltas-only` failed (missing Why section) | Will inspect change files directly |

## Resources
- `scripts/copy-trading-worker.ts`
- `src/services/copy-trading-execution-service.ts`
- `docs/guides/real_trading_architecture.md`
- `openspec/AGENTS.md`
- `openspec/project.md`

## Visual/Browser Findings
- None
