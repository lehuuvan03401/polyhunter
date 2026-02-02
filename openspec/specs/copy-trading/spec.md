# copy-trading Specification

## Purpose
TBD - created by archiving change fix-copy-trading-critical-issues. Update Purpose after archive.
## Requirements
### Requirement: Price Fetching
The system SHALL fetch real-time market prices before calculating order sizes. Price data SHALL be cached with a maximum TTL of 5 seconds to reduce API load.

#### Scenario: Fetching price for BUY order
- GIVEN a TransferSingle event is detected for a monitored trader buying token X
- WHEN the Supervisor dispatches jobs to subscribers
- THEN the system fetches the current ask price from the OrderBook before calculating position size
- AND the fetched price is used instead of hardcoded default

#### Scenario: Price caching within TTL
- GIVEN a price was fetched for token X at time T
- WHEN another event for token X occurs at time T+3s
- THEN the cached price is returned without making a new API call

---

### Requirement: Debt Logging on Reimbursement Failure
When bot float reimbursement fails, the system SHALL record a debt entry in the database. The Supervisor SHALL attempt debt recovery on startup and every 5 minutes thereafter.

#### Scenario: Logging debt on reimbursement failure
- GIVEN a bot used its float to buy tokens for a user
- WHEN the reimbursement transfer from Proxy to Bot fails due to insufficient funds
- THEN a debt record is created with proxyAddress, botAddress, amount, and error reason
- AND the trade execution returns with partial success status

#### Scenario: Periodic debt recovery
- GIVEN there are pending debt records in the database
- WHEN the Supervisor starts or the 5-minute interval elapses
- THEN the DebtManager attempts to recover each pending debt
- AND successfully recovered debts are marked as repaid

---

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

### Requirement: Position Balance Verification
Before executing a SELL order, the system SHALL verify the user's actual token balance. If actual balance is zero, the SELL order SHALL be skipped.

#### Scenario: Checking balance before SELL
- GIVEN a user has 500 tokens in their Proxy
- AND a copy trade signal indicates selling 1000 tokens
- WHEN the ExecutionService prepares the SELL
- THEN it queries the CTF contract for actual balance
- AND caps the sell amount at 500 tokens

#### Scenario: Skipping SELL with zero balance
- GIVEN a user has 0 tokens of the target asset
- WHEN a SELL copy trade is triggered
- THEN the system logs "No tokens to sell, skipping"
- AND returns without executing any transaction

---

### Requirement: Filter Validation
The system SHALL validate configured market filters before executing any copy trade. Supported filters include: minLiquidity, minVolume, maxOdds, maxDaysOut.

#### Scenario: Validating minLiquidity filter
- GIVEN a user config has minLiquidity set to 5000
- AND the target market has 3000 in total liquidity
- WHEN a copy trade signal arrives
- THEN the trade is skipped
- AND the log shows "Trade skipped: minLiquidity filter failed"

#### Scenario: maxOdds filter
- GIVEN a user config has maxOdds set to 0.85
- AND the current price is 0.92
- WHEN a BUY copy trade signal arrives
- THEN the trade is skipped with log "Trade skipped: maxOdds filter failed"

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

### Requirement: Simple Mode Default Sizing
The Simple Mode UI SHALL use Range mode by default instead of Fixed Amount mode. The default proportional sizing SHALL be 10% of the trader's position, with a minimum of $5 and maximum of $100 per trade.

#### Scenario: Simple Mode uses proportional sizing
- GIVEN a user opens the Copy Trader modal in Simple Mode
- AND the target trader buys $1,000 worth of shares
- WHEN the user starts copying with default settings
- THEN the copy trade size is calculated as 10% of $1,000 = $100
- AND the trade executes for $100

#### Scenario: Simple Mode respects maximum cap
- GIVEN a user starts copying in Simple Mode with max $100 per trade
- AND the target trader buys $5,000 worth of shares
- WHEN the copy trade is triggered
- THEN the copy trade size is capped at $100 (instead of 10% = $500)

#### Scenario: Simple Mode respects minimum floor
- GIVEN a user starts copying in Simple Mode with min $5 per trade
- AND the target trader buys $30 worth of shares
- WHEN the copy trade is triggered
- THEN the copy trade size is set to $5 (instead of 10% = $3)

#### Scenario: Simple Mode sends Range parameters to API
- GIVEN a user clicks "Start Copying" in Simple Mode
- WHEN the API request is sent
- THEN the payload includes `mode: 'percentage'`, `sizeScale: 0.10`, `minSizePerTrade: 5`, and `maxSizePerTrade` equal to the user's max input

