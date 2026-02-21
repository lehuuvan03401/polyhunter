# Align Price Source Spec

## MODIFIED Requirements

### Requirement: Consistent Pricing
The simulation summary MUST utilize the same pricing priority as the Frontend to minimize PnL discrepancies.

#### Scenario: Active Position Pricing
Given an open position
When generating the summary report
Then the script attempts to fetch the current price from the CLOB (Orderbook) first
And falls back to Gamma API only if CLOB is unavailable
