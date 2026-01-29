## MODIFIED Requirements
### Requirement: `PortfolioPage` Dashboard Cards
The top row of cards on `/portfolio` MUST display simulation-aware metrics and refresh via adaptive polling to reduce load.

#### Scenario: displaying invested funds
- **GIVEN** the user has active copy trades in simulation
- **WHEN** viewing the Portfolio page
- **THEN** display a card "Invested Funds" showing the total cost basis of open simulated positions
- **AND** this value should update as the simulation executes new buy orders

#### Scenario: adaptive polling
- **GIVEN** the user keeps the Portfolio page open
- **WHEN** the dashboard refreshes data
- **THEN** polling for heavy endpoints SHOULD be no more frequent than every 15 seconds
- **AND** manual refresh MUST still be available for immediate updates
