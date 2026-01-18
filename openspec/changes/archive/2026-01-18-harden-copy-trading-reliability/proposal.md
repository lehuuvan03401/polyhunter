# Change: Harden Copy Trading Reliability

## Why
The copy trading system is functional but has reliability gaps that could cause duplicate executions, stuck transactions, and missed trades. These issues must be addressed before production deployment.

## What Changes
- **Unified Deduplication**: Consolidate WS (`ws:txHash:asset`) and chain (`txHash:logIndex`) deduplication into single `txHash`-based system
- **Transaction Monitoring**: Add stuck transaction detection (>5 min pending) with automatic gas replacement
- **Health Metrics**: Add basic observability (execution count, latency, success rate logging)

## Impact
- **Affected specs**: `copy-trading`
- **Affected code**:
  - `frontend/scripts/copy-trading-supervisor.ts` - Dedup logic, TX monitoring
  - `src/services/realtime-service-v2.ts` - Minor (already fixed)
  - New: `src/core/tx-monitor.ts` - Transaction monitoring service
