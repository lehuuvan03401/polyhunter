# positions-ui Spec Delta

## ADDED Requirements

### Requirement: Positions Table Columns
The Positions table MUST display enhanced columns for better clarity.

#### Scenario: Displaying estimated value
- **GIVEN** a position with `size = 100` and `curPrice = 0.50`
- **WHEN** viewing the Positions tab
- **THEN** display an "Est. Value" column showing `$50.00`

#### Scenario: Displaying PnL with correct sign
- **GIVEN** a position where `avgEntryPrice = curPrice`
- **WHEN** viewing the Positions tab
- **THEN** display `+0.00%` (not `-100.00%`)

## ADDED Requirements

### Requirement: Position Status Badge
The UI MUST display a status badge for each position.

#### Scenario: Open position
- **GIVEN** a position in an unresolved market
- **WHEN** viewing the Positions tab
- **THEN** display a green "OPEN" badge

#### Scenario: Simulated position indicator
- **GIVEN** a simulated position (from copy trading)
- **WHEN** viewing the Positions tab
- **THEN** display a blue "SIM" badge alongside the status

### Requirement: Outcome Badge Styling
Outcome badges MUST be color-coded for quick visual identification.

#### Scenario: Up/Yes outcomes
- **GIVEN** an outcome labeled "Up" or "Yes"
- **WHEN** viewing the Positions tab
- **THEN** display a green-styled badge

#### Scenario: Down/No outcomes
- **GIVEN** an outcome labeled "Down" or "No"
- **WHEN** viewing the Positions tab
- **THEN** display a red-styled badge

#### Scenario: Unknown outcomes
- **GIVEN** an outcome is "?" or null
- **WHEN** viewing the Positions tab
- **THEN** display a gray "Unknown" badge
