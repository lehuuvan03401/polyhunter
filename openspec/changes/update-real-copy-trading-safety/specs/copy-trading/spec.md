## MODIFIED Requirements
### Requirement: Event Deduplication
The system SHALL track processed blockchain events using `txHash` as the primary key and MUST enforce idempotency at the database layer for each copy-trading configuration. Duplicate events within 60 seconds SHALL be ignored regardless of detection channel (WebSocket or chain listener).

#### Scenario: Rejecting duplicate event from same channel
- GIVEN event with txHash "0xABC123" was processed 30 seconds ago for config X
- WHEN the same event is received again from the chain listener
- THEN the system skips processing and logs "Duplicate event ignored"
- AND no new CopyTrade row is created

#### Scenario: Rejecting duplicate event across channels
- GIVEN a trade with txHash "0xABC123" was detected via WebSocket and processed for config X
- WHEN the same trade is detected via TransferSingle chain event 1 second later
- THEN the system skips processing using the same txHash-based deduplication
- AND logs "Duplicate event ignored: 0xABC123"

#### Scenario: Fallback idempotency when txHash missing
- GIVEN an incoming trade event has no txHash
- WHEN the system computes the fallback idempotency key for config X
- THEN the system uses the fallback key to enforce idempotency
- AND duplicate trades within the same bucket are ignored

## ADDED Requirements
### Requirement: Pre-Execution Validation
Before executing a real BUY or SELL, the system SHALL validate required balances and allowances and clamp SELL size to available balance.

#### Scenario: BUY blocked by insufficient allowance
- GIVEN a user proxy has USDC balance but insufficient allowance
- WHEN a BUY copy trade is prepared
- THEN the system marks the trade as skipped with reason "insufficient allowance"
- AND does not submit a transaction

#### Scenario: SELL clamped to available balance
- GIVEN a user proxy has 50 shares and a SELL copy trade requests 100 shares
- WHEN the trade is prepared
- THEN the system caps the SELL to 50 shares
- AND records the adjusted copySize in the CopyTrade record

### Requirement: Execution Price Guard
The system SHALL fetch a fresh executable price (max TTL 5 seconds) and reject execution if the price is stale or violates the configured slippage bounds.

#### Scenario: Reject stale price
- GIVEN the cached price for token X is older than 5 seconds
- WHEN a trade execution is prepared
- THEN the system fetches a fresh price before execution
- AND rejects execution if the fresh price is still unavailable

#### Scenario: Reject slippage beyond limit
- GIVEN a trade is prepared with maxSlippage 1%
- WHEN the executable price implies slippage above 1%
- THEN the system rejects execution and logs "slippage limit exceeded"
