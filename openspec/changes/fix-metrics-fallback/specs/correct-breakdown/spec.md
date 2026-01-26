# Correct Metrics Breakdown Spec

## ADDED Requirements

### Requirement: Accurate Breakdown
The metrics API MUST ensure that the sum of `realizedWins` and `realizedLosses` equals the total `tradingPnL`, even when utilizing fallback calculations for legacy data.

#### Scenario: Legacy Trades
Given a set of historical trades with `realizedPnL = null`
When the metrics API calculates their values on-the-fly
Then it MUST distribute the profit/loss to `realizedWins` or `realizedLosses` accordingly
