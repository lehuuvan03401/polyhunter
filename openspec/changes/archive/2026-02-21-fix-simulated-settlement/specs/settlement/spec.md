# Spec: Simulated Market Settlement

## ADDED Requirements

### Requirement: Handle Market Resolution
The system MUST detect when a market is resolved and update all associated simulated positions.

#### Scenario: Winning Position Settlement
Given a simulated position of 100 shares of "Trump Yes" matches a market that resolves to "Yes"
When the `market_resolved` event is received
Then the position should be closed (redeemed) at $1.00 per share
And a history record should be created showing a Sell at $1.00
And the Open Position should be removed

#### Scenario: Losing Position Settlement
Given a simulated position of 100 shares of "Trump No" matches a market that resolves to "Yes"
When the `market_resolved` event is received
Then the position should be closed (redeemed) at $0.00 per share
And a history record should be created showing a Sell at $0.00
And the Open Position should be removed
