# portfolio-api Specification

## Purpose
TBD - created by archiving change realtime-portfolio-metrics. Update Purpose after archive.
## Requirements
### Requirement: `GET /api/copy-trading/metrics`
The system MUST provide an endpoint that aggregates financial metrics from `UserPosition` and `CopyTrade` tables for the authenticated user.

#### Scenario: Fetching simulated portfolio metrics
- **GIVEN** a user has executed 10 buy trades ($100 each) in the simulation
- **AND** has sold 2 of them ($20 profit)
- **WHEN** the frontend requests `/api/copy-trading/metrics`
- **THEN** the response should include `totalInvested` of $800
- **AND** `realizedPnL` should be $20
- **AND** `activePositions` should be 8

#### Scenario: Empty state
- **GIVEN** a new user with no trades
- **WHEN** requesting metrics
- **THEN** all values should be 0

### Requirement: `GET /api/copy-trading/positions?simulated=true`
The system MUST return open positions from the local database when simulated mode is requested.

#### Scenario: Merging positions
- **GIVEN** the user wants to see simulation progress
- **WHEN** fetching positions with `simulated=true`
- **THEN** return list of `UserPosition` records
- **AND** include `tokenId`, `balance`, `avgEntryPrice`

