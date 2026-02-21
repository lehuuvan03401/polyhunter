# On-Chain Redemption Spec

## ADDED Requirements

### Requirement: Real Execution
When a market is resolved, the worker MUST execute an on-chain transaction to redeem positions via the user's Proxy wallet.

#### Scenario: Market Resolved
Given a user holds winning positions under `copy-trading-worker.ts`
When the market resolves
Then the worker calls `CopyTradingExecutionService.redeemPositions()`

### Requirement: Robust Detection
The worker MUST detect winning positions by checking Gamma API `winner` boolean and `closed` status.

#### Scenario: Data Gap
Given a market is resolved but price is 0
When the worker checks status
Then it uses `winner: true` to trigger redemption

### Requirement: PnL Traceability
The worker MUST calculate the realized PnL of the redemption.

#### Scenario: Logging PnL
Given a successful redemption
Then the worker updates `CopyTrade.realizedPnL` with `(RedemptionAmount - TotalCost)`
