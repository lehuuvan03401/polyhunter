# Change: Add RPC Failover for Copy Trading Execution

## Why
Real-time copy trading depends on RPC reliability. A single RPC outage or slowdown can cause missed trades or execution failures. We need automatic failover to secondary RPCs.

## What Changes
- Add multi-RPC configuration for copy-trading execution.
- Implement health checks and automatic fallback on failure.
- Log active RPC selection and failover events.

## Impact
- Affected specs: `copy-execution`
- Affected code: copy-trading worker, execution provider setup, verification scripts.
