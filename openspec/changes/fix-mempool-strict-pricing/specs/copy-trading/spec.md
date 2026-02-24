## ADDED Requirements

### Requirement: Mempool Pricing Must Use Market Data
The supervisor SHALL derive mempool copy-trade sizing prices from side-aware market data and MUST NOT use fixed placeholder pricing.

#### Scenario: Valid mempool price available
- **GIVEN** a mempool signal is detected
- **WHEN** a valid side-aware orderbook price (or acceptable cached fallback) is available
- **THEN** supervisor uses that price for sizing and dispatch

#### Scenario: Mempool price unavailable
- **GIVEN** a mempool signal is detected
- **AND** no valid side-aware price can be resolved
- **WHEN** supervisor evaluates the signal
- **THEN** supervisor skips dispatch for that signal
- **AND** persists an audit event indicating missing mempool price
