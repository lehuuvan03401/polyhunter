# Trade Details Spec

## MODIFIED Requirements

### Requirement: trade-history-details
The user MUST be able to see granular details of recent trades.

#### Scenario: Viewing Recent Trades
Given the user is on a Trader Profile page
When they look at the Recent Trades list
Then each trade entry MUST display:
- Action (Bought/Sold)
- Market Name
- Execution Price
- Number of Shares
- Total Value
- Date and Time (including seconds)
