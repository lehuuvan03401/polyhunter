# Task Plan: Real copy-trading optimization rollout
<!--
  WHAT: Roadmap for sequential, safe, high-performance improvements.
  WHY: Keep goals and gating (OpenSpec) explicit.
-->

## Goal
Create and execute OpenSpec change proposals and implement real copy-trading optimizations one item at a time, prioritizing safety and performance.

## Current Phase
Phase 4 (testing)

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm optimization order and scope for item 1
- [x] Review relevant specs and active changes
- [x] Capture key risks/constraints in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Draft OpenSpec change proposal for item 1
- [x] Define tasks and (if needed) design decisions
- [x] Validate proposal via openspec
- **Status:** complete

### Phase 3: Implementation
- [x] Implement approved proposal tasks
- [x] Add/update tests as needed
- [x] Update tasks checklist to complete
- [x] Wire debt logging + recovery into worker execution path
- [x] Document or verify debt recovery behavior
- [x] Implement scoped tx mutex for per-signer serialization
- [x] Add verification notes for scoped mutex
- **Status:** complete
 
### Phase 3: Implementation (Orderbook Quote Cache)
- [x] Implement quote cache + in-flight dedupe
- [x] Add logging/metrics for cache hits/misses
- [x] Add verification notes for cache behavior
- **Status:** complete

### Phase 3: Implementation (Proxy Execution Queue)
- [x] Implement proxy-scoped mutex for fund/settlement
- [x] Add verification notes for proxy queue
- **Status:** complete

### Phase 3: Implementation (Preflight Balance Cache)
- [x] Implement preflight cache + in-flight dedupe
- [x] Add logging/metrics for cache hits/misses
- [x] Add verification notes for cache behavior
- **Status:** complete

### Phase 3: Implementation (Price Fallback)
- [x] Implement fallback price selection
- [x] Log price source and fallback usage
- [x] Add verification notes for fallback behavior
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Run relevant tests / targeted verification
- [ ] Document results in progress.md
- [ ] Fix any regressions
- **Status:** pending

### Phase 5: Delivery
- [ ] Summarize changes and remaining work
- [ ] Propose next optimization item
- **Status:** pending

## Key Questions
1. Which optimization item is first (default: idempotency + write-before-execute)?
2. One proposal per item or a combined proposal for multiple items?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use sequential OpenSpec proposals | Safer rollout, clearer approvals, smaller blast radius |
| Change id: `add-copy-trade-prewrite` | Targets orphan-execution risk without duplicating existing changes |
| Next change id: `add-scoped-tx-mutex` | Enables parallel execution across distinct signers |
| Next change id: `add-orderbook-quote-cache` | Reduces redundant orderbook fetches under burst load |
| Next change id: `add-proxy-execution-queue` | Serializes fund operations per proxy to avoid overlap |
| Next change id: `add-preflight-balance-cache` | Caches preflight reads to reduce RPC load |
| Next change id: `add-price-fallback` | Adds fallback price source when orderbook unavailable |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| CLAUDE_PLUGIN_ROOT not set for session-catchup script | 1 | Used local skill templates path to create planning files |
| openspec show optimize-real-copy-trading --json --deltas-only failed (missing Why section) | 1 | Will inspect change files directly instead of openspec show |
| verify script failed to load @prisma/client | 1 | Added dynamic import with friendly error; requires deps installed |
