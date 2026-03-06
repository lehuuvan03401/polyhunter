## ADDED Requirements

### Requirement: Position Cost Basis Integrity

The copy-trading system SHALL preserve correct cost basis for partially and fully closed positions across all execution paths.

#### Scenario: Partial SELL preserves remaining average entry price
- **GIVEN** a follower holds 100 shares with `totalCost=40` and `avgEntryPrice=0.40`
- **WHEN** a copy-trade SELL closes 25 shares
- **THEN** the remaining position balance is 75 shares
- **AND** the remaining `totalCost` is reduced to 30
- **AND** the remaining `avgEntryPrice` remains 0.40

#### Scenario: Full SELL clears the open position ledger
- **GIVEN** a follower holds an open position for a token
- **WHEN** a copy-trade SELL closes the remaining shares
- **THEN** the resulting position balance is 0
- **AND** the resulting `totalCost` is 0
- **AND** the resulting `avgEntryPrice` is 0

### Requirement: Execution Path Ledger Consistency

The copy-trading system SHALL apply the same position and realized-PnL accounting semantics regardless of whether a trade is finalized by supervisor automation or a compatibility execution route.

#### Scenario: Server-side API execution updates the same ledgers
- **GIVEN** a pending copy trade is executed through the server-side compatibility API
- **WHEN** the execution succeeds
- **THEN** `CopyTrade`, `UserPosition`, and realized PnL state are updated using the same accounting rules as supervisor-driven execution

#### Scenario: Compatibility route cannot advance trade status without ledger updates
- **GIVEN** a compatibility execution route attempts to finalize a copy trade
- **WHEN** the shared accounting update fails
- **THEN** the route does not leave the trade marked as successfully executed while position state remains stale
