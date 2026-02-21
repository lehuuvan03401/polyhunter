# Correct Volume Calculation Spec

## MODIFIED Requirements

### Requirement: Accurate Volume Tracking
The simulation script MUST calculate `totalBuyVolume` and `totalSellVolume` using the actual value of the trades executed, not a fixed placeholder.

#### Scenario: Buy Volume
Given a buy trade of 100 shares at $0.50
When the trade is recorded
Then `totalBuyVolume` increases by $50.00 (100 * 0.50)

#### Scenario: Sell Volume
Given a sell trade of 100 shares at $0.60
When the trade is recorded
Then `totalSellVolume` increases by $60.00 (100 * 0.60)
