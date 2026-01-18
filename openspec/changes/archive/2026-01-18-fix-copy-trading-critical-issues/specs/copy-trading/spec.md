# Copy Trading Execution Spec Delta

## ADDED Requirements

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
The system SHALL track processed blockchain events using txHash and logIndex. Duplicate events within 60 seconds SHALL be ignored.

#### Scenario: Rejecting duplicate event
- GIVEN event "ABC:5" was processed 30 seconds ago
- WHEN the same event is received again
- THEN the system skips processing and logs "Duplicate event ignored"

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
