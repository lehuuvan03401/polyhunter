# fee-logic Specification

## Purpose
TBD - created by archiving change implement-profit-based-fees. Update Purpose after archive.
## Requirements
### Requirement: Affiliate Commission Trigger
The system MUST ONLY trigger commission distribution when a copy-trade results in a realized profit for the follower.

#### Scenario: Trade results in a loss
Given a follower has a position with Average Entry Price of $1.00
When the follower sells the position at $0.90 (Loss)
Then `distributeCommissions` MUST NOT be called
And no commission log is created

#### Scenario: Trade results in a profit
Given a follower has a position with Average Entry Price of $1.00
When the follower sells the position at $1.10 (Profit)
Then `distributeCommissions` MUST be called with `profit = $0.10 * amount`

### Requirement: Affiliate Commission Rate
The system MUST calculate the commission amount based on the follower's cumulative trading volume tier applied to the realized profit.

#### Scenario: Low Volume Follower Fee
Given a follower has a cumulative volume of $5,000 (Tier 1)
And the Fee Rate for Tier 1 is 20%
When the follower realizes a profit of $100
Then the calculated commission amount MUST be $20 ($100 * 20%)

#### Scenario: High Volume Follower Fee
Given a follower has a cumulative volume of $200,000 (Top Tier)
And the Fee Rate for Top Tier is 10%
When the follower realizes a profit of $100
Then the calculated commission amount MUST be $10 ($100 * 10%)

