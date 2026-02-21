## MODIFIED Requirements
### Requirement: Stuck Transaction Detection
The system SHALL monitor submitted on-chain execution transactions (fund transfers, token transfers, and redemptions) for confirmation. Transactions pending for more than 5 minutes SHALL be flagged as "stuck" and automatically replaced with higher gas.

#### Scenario: Detecting stuck transaction
- GIVEN the Supervisor submitted an execution transaction with hash "0xTX1" at 10:00:00
- WHEN the transaction has not been confirmed by 10:05:00
- THEN the TxMonitor flags "0xTX1" as stuck
- AND logs "[TxMonitor] ⚠️ Stuck TX detected: 0xTX1"

#### Scenario: Replacing stuck transaction
- GIVEN transaction "0xTX1" is flagged as stuck with nonce 42
- WHEN the replacement is triggered
- THEN the system submits a new transaction with nonce 42 and 20% higher maxPriorityFeePerGas
- AND logs "[TxMonitor] 🔄 Replacing TX 0xTX1 with higher gas"
