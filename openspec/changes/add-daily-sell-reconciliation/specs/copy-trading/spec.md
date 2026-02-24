## ADDED Requirements

### Requirement: Scheduled SELL Reconciliation
The supervisor SHALL run a scheduled reconciliation process for recently executed SELL trades.

#### Scenario: Reconciliation cycle runs
- **GIVEN** reconciliation is enabled
- **WHEN** the configured reconciliation interval elapses
- **THEN** the supervisor scans recent SELL trades in final/pending settlement states
- **AND** attempts to fetch fill notional from order execution records

#### Scenario: Reconcile mismatch
- **GIVEN** a SELL trade has fill-derived notional available
- **AND** absolute difference between fill notional and stored `copySize` exceeds threshold
- **WHEN** reconciliation processes the trade
- **THEN** the trade `copySize` and `copyPrice` are corrected to fill-aware values
- **AND** an audit event is persisted
