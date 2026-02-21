# Correct Metrics Fallback Logic

## MODIFIED Requirements

### Requirement: Correct Unit Handling in Metrics Fallback
The metrics API fallback calculation (for trades missing realized PnL) MUST correctly interpret `copySize` as "Number of Shares" to accurately calculate cost basis and profit.

#### Scenario: Calculating PnL for Legacy Trades
Given a completed SELL trade without a stored `realizedPnL` value
When the metrics API calculates PnL
Then it MUST use `copySize` as the number of shares
And calculate Cost Basis as `Sum(BuyShares * BuyPrice)`
And calculate Profit as `(SellPrice - AverageBuyPrice) * SellShares`
