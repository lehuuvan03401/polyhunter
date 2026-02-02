# copy-trading Specification

## ADDED Requirements

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
