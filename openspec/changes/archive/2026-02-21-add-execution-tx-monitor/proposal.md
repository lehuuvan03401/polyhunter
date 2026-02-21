# Change: Integrate Execution Tx Monitor for Stuck Transactions

## Why
The system already defines stuck transaction handling in the `copy-trading` spec, and a TxMonitor exists in core, but execution paths do not yet track and replace pending on-chain transactions. This leaves transfers and settlements vulnerable to being stuck during congestion.

## What Changes
- Wire `TxMonitor` into execution flows to track on-chain transactions (fund pulls/returns, token transfers, redemption).
- Replace stuck transactions after a threshold using higher priority fees while preserving nonce.
- Log monitor status and replacement attempts for observability.

## Impact
- Affected specs: `copy-trading`
- Affected code: `src/core/tx-monitor.ts`, `src/services/copy-trading-execution-service.ts`, worker initialization
