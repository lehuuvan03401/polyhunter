# Metrics Display Spec

## MODIFIED Requirements

### Requirement: detailed-metrics-context
The user MUST clearly understand the time period for each metric.

#### Scenario: Viewing Profile Stats
Given the user is on the Trader Profile page
When they see the stats headers
Then "Total PnL" and "Volume" MUST have an "ALL TIME" indicator
AND "Win Rate" MUST be accurately calculated or clearly labeled (e.g. "Active Accuracy" if based on positions) to prevent misleading "100%" values.
