# Four Decimals Spec

## MODIFIED Requirements

### Requirement: Increased Precision
The Portfolio table MUST display financial values with 4 decimal places to provide more granular data to the user.

#### Scenario: Displaying Avg Price
Given a position with an average price of $0.45321
When displayed in the table
Then it MUST show "$0.4532" (rounded to 4 decimals)

#### Scenario: Displaying PnL
Given a PnL of $10.12345
When displayed in the table
Then it MUST show "+$10.1235" (rounded to 4 decimals)
