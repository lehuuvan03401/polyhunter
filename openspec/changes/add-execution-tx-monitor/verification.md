# Verification Notes: Execution Tx Monitor

## Manual Checks
- Stuck detection:
  - Submit a transaction and block its confirmation (e.g., set very low gas).
  - Wait >5 minutes (or lower threshold in config for testing).
  - Expect log: `[TxMonitor] ⚠️ Stuck TX detected ...`.

- Replacement:
  - Confirm a replacement transaction is submitted with higher maxPriorityFeePerGas.
  - Expect log: `[TxMonitor] 🔄 TX replaced ...`.

## Expected Outcome
- Pending execution transactions are tracked.
- Stuck transactions are replaced without nonce conflicts.
