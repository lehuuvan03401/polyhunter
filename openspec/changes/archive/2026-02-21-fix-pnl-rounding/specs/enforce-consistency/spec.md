# Consistency Enforcement Spec

## MODIFIED Requirements

### Requirement: Mathematical Consistency
The metrics API response MUST guarantee that the Total Realized PnL is exactly equal to the sum of Realized Wins and Realized Losses.

#### Scenario: Rounding Alignment
Given a floating point drift of $0.01 between accumulation vars
When the API finalizes the response
Then it recalculates Total = Wins + Losses to ensure equality
