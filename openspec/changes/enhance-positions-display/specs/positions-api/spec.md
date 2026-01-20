# positions-api Spec Delta

## ADDED Requirements

### Requirement: PnL Calculation Safety
The `/api/copy-trading/positions` endpoint MUST handle edge cases in PnL calculation to prevent incorrect values.

#### Scenario: Zero average entry price
- **GIVEN** a position has `avgEntryPrice = 0`
- **WHEN** calculating `percentPnl`
- **THEN** return `0` instead of `Infinity` or `NaN`

#### Scenario: Null current price
- **GIVEN** a position's current market price cannot be fetched
- **WHEN** building the response
- **THEN** use `avgEntryPrice` as fallback for `curPrice`
- **AND** display `percentPnl = 0`

#### Scenario: Matching entry and current price
- **GIVEN** `avgEntryPrice = 0.30` and `curPrice = 0.30`
- **WHEN** calculating PnL
- **THEN** return `percentPnl = 0` (not -100%)

## ADDED Requirements

### Requirement: Position Estimated Value
The positions API response MUST include an `estValue` field.

#### Scenario: Calculating estimated value
- **GIVEN** a position with `size = 100` and `curPrice = 0.50`
- **WHEN** fetching positions
- **THEN** include `estValue = 50.00` in the response

### Requirement: Human-Readable Market Title
The positions API response MUST include a properly formatted market title.

#### Scenario: Parsing time-based market slugs
- **GIVEN** a position with `marketSlug = "btc-updown-15m-1768895100"`
- **WHEN** building the response
- **THEN** return `title = "BTC 15min Up/Down"` or similar readable format
- **AND** avoid displaying raw slugs like "Unknown Market"
