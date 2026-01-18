## MODIFIED Requirements

### Requirement: Event Deduplication
The system SHALL track processed blockchain events using `txHash` as the primary key. Duplicate events within 60 seconds SHALL be ignored regardless of detection channel (WebSocket or chain listener).

#### Scenario: Rejecting duplicate event from same channel
- GIVEN event with txHash "0xABC123" was processed 30 seconds ago
- WHEN the same event is received again from the chain listener
- THEN the system skips processing and logs "Duplicate event ignored"

#### Scenario: Rejecting duplicate event across channels
- GIVEN a trade with txHash "0xABC123" was detected via WebSocket and processed
- WHEN the same trade is detected via TransferSingle chain event 1 second later
- THEN the system skips processing using the same txHash-based deduplication
- AND logs "Duplicate event ignored: 0xABC123"

---

## ADDED Requirements

### Requirement: Stuck Transaction Detection
The system SHALL monitor submitted transactions for confirmation. Transactions pending for more than 5 minutes SHALL be flagged as "stuck" and automatically replaced with higher gas.

#### Scenario: Detecting stuck transaction
- GIVEN the Supervisor submitted a transaction with hash "0xTX1" at 10:00:00
- WHEN the transaction has not been confirmed by 10:05:00
- THEN the TxMonitor flags "0xTX1" as stuck
- AND logs "[TxMonitor] ⚠️ Stuck TX detected: 0xTX1"

#### Scenario: Replacing stuck transaction
- GIVEN transaction "0xTX1" is flagged as stuck with nonce 42
- WHEN the replacement is triggered
- THEN the system submits a new transaction with nonce 42 and 20% higher maxPriorityFeePerGas
- AND logs "[TxMonitor] 🔄 Replacing TX 0xTX1 with higher gas"

---

### Requirement: Health Metrics Logging
The system SHALL log execution metrics every 5 minutes including total executions, success rate, and average latency.

#### Scenario: Periodic metrics logging
- GIVEN the Supervisor has executed 50 trades in the last 5 minutes
- AND 48 succeeded and 2 failed
- AND average latency is 1.2 seconds
- WHEN the 5-minute interval elapses
- THEN the system logs "[Metrics] 📊 Last 5min: 50 executions, 96% success, 1.2s avg latency"
