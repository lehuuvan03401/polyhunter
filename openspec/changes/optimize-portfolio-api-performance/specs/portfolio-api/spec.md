## ADDED Requirements
### Requirement: Short‑lived caching for portfolio endpoints
The system SHALL cache responses for copy‑trading portfolio endpoints with a short TTL to avoid repeated external lookups under polling.

#### Scenario: repeated polling within TTL
- **GIVEN** a wallet requests `/api/copy-trading/positions` multiple times within 30 seconds
- **WHEN** the second request arrives within the cache TTL
- **THEN** the server returns a cached response without re‑fetching external market data

### Requirement: Batched external price and resolution lookups
The system SHALL batch external market lookups and reuse recent results to minimize external API load.

#### Scenario: multiple positions in the same polling window
- **GIVEN** a wallet has 20 open positions
- **WHEN** the portfolio endpoints need current prices
- **THEN** the system batches CLOB/Gamma requests with bounded concurrency
- **AND** reuses cached token prices within the TTL window

## MODIFIED Requirements
### Requirement: `GET /api/copy-trading/metrics`
The system MUST provide an endpoint that aggregates financial metrics from `UserPosition` and `CopyTrade` tables for the authenticated user and reuse cached external price data when available.

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
