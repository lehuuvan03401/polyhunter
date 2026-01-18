# Design: Harden Copy Trading Reliability

## Context
The Copy Trading Supervisor uses two detection channels:
1. **WebSocket (Activity)**: ~500ms latency, but global subscription may not work
2. **Chain Events (TransferSingle)**: ~2s latency, reliable but slower

Both channels can detect the same trade, leading to potential duplicate execution if deduplication keys differ.

## Goals / Non-Goals
**Goals:**
- Prevent duplicate order execution for the same underlying trade
- Auto-recover from stuck/pending transactions
- Provide basic observability for production monitoring

**Non-Goals:**
- Full distributed architecture (Redis/Kafka)
- Guaranteed <100ms latency (depends on external factors)
- Complex alerting system (use logs for MVP)

## Decisions

### 1. Deduplication Key: `txHash` Only
**Decision**: Use only `txHash` as the deduplication key, not `txHash:logIndex` or `ws:txHash:asset`.

**Rationale**:
- A single on-chain transaction can trigger multiple events (batch trades)
- But for copy trading, we want to copy the *intent* (the TX), not each sub-event
- Simplifies cross-channel deduplication

**Trade-off**: May miss legitimate separate trades if trader does multiple TXs in <60s window. Acceptable for MVP.

### 2. Transaction Monitor: Polling-Based
**Decision**: Use simple polling (every 30s) to check TX confirmation status.

**Alternatives Considered**:
- `provider.waitForTransaction()` with timeout: More elegant but harder to track multiple TXs
- Event-based with `eth_subscribe`: Requires WSS provider, adds complexity

**Rationale**: Polling is simple, testable, and works with any RPC provider.

### 3. Gas Replacement Strategy
**Decision**: If TX pending >5 minutes, replace with 20% higher maxPriorityFeePerGas.

**Steps**:
1. Re-submit same TX data with same nonce
2. `maxPriorityFeePerGas *= 1.2`
3. Mark original as "replaced" in monitor

**Risk**: If original TX is mined during replacement, one will fail (acceptable).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Aggressive dedup misses valid trades | 60s TTL limits window; most traders don't repeat <1 min |
| Gas replacement wastes funds | Only trigger after 5 min; 20% bump is conservative |
| Metrics add overhead | Console logging only; no storage or network cost |

## Migration Plan
1. Deploy updated Supervisor with new dedup logic
2. Monitor for 24h before enabling TX replacement
3. Add metrics endpoint in follow-up PR

## Open Questions
- Should we expose a health check endpoint for load balancers?
- Should we integrate with external monitoring (Datadog, etc.)? (Defer to Phase 2)
