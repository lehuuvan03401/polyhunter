# Use Winner Status for Redemption

## MODIFIED Requirements

### Requirement: Robust Redemption Trigger
The simulation script MUST use the `winner` status and `closed` state from market metadata to trigger auto-redemption, in addition to price thresholds, ensuring all settled positions are correctly realized.

#### Scenario: Market Resolved but Price Missing
Given a simulation position in a market that has resolved
And the Gamma API returns `winner: true` for the token
But the price is not available or 0
When the redemption check runs
Then the position MUST be redeemed as a WIN (Price = 1.0)
