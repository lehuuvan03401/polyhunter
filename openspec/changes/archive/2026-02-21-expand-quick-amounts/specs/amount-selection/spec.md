# Quick Amounts Spec

## MODIFIED Requirements

### Requirement: flexible-amount-input
The user MUST be able to quickly select common trade sizes, including small test amounts.

#### Scenario: Selecting Amount
Given the user is configuring a Fixed Amount copy trade
When they look at the amount input
Then they SHOULD see 6 quick options: $1, $5, $10, $25, $50, $100
AND they MUST be displayed in a 2-row grid for easy clicking.
