# Record Realized PnL

## ADDED Requirements

### Requirement: Record Realized PnL in Simulation
The simulation script MUST record the calculated Realized PnL to the database for every SELL trade to ensuring accurate historical performance tracking.

#### Scenario: Sell Trade Execution
Given the simulation executes a SELL trade
When `recordCopyTrade` is called
Then the `realizedPnL` field in the database record MUST be populated with the calculated PnL value
