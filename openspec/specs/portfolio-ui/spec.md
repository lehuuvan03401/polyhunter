# portfolio-ui Specification

## Purpose
TBD - created by archiving change realtime-portfolio-metrics. Update Purpose after archive.
## Requirements
### Requirement: `PortfolioPage` Dashboard Cards
The top row of cards on `/portfolio` MUST display simulation-aware metrics.

#### Scenario: displaying invested funds
- **GIVEN** the user has active copy trades in simulation
- **WHEN** viewing the Portfolio page
- **THEN** display a card "Invested Funds" showing the total cost basis of open simulated positions
- **AND** this value should update as the simulation executes new buy orders

#### Scenario: displaying real-time PnL
- **GIVEN** the user is running a simulation
- **WHEN** viewing the Portfolio page
- **THEN** the "Profit/Loss" card should show the sum of Realized + Unrealized PnL from the simulation DB
- **AND** it should poll/refresh frequently (e.g. every 3-5 seconds)

### Requirement: Positions Tab
The "Positions" tab SHALL optionally show simulated positions.

#### Scenario: viewing simulated positions
- **GIVEN** the user has "Simulation Mode" active (or by default if no real positions)
- **WHEN** viewing the Positions tab
- **THEN** list positions fetched from the local DB (`UserPosition` table)
- **AND** ensure they are clearly distinquishable or merged with real positions

