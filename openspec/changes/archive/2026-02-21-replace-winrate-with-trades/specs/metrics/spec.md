# Metrics Spec

## MODIFIED Requirements

### Requirement: reliable-profile-metrics
The user MUST see reliable, verifiable metrics on the profile page.

#### Scenario: Viewing Profile Stats
Given the user is on the Trader Profile page
When they see the stats headers
Then they SHOULD see "Trades (All Time)" instead of "Win Rate"
AND the value MUST represent the total number of trades executed by the account.
