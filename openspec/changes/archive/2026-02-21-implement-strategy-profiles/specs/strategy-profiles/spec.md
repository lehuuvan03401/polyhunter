
# Strategy Profiles

## ADDED Requirements

### Requirement: Strategy Profile Configuration

The system MUST store a specific Strategy Profile for each user's copy trading configuration.

#### Scenario: User selects a strategy profile
Given a user is on the Proxy Dashboard
When they select "Conservative" from the bot authorization settings
Then the system updates their configuration to use the `CONSERVATIVE` profile
And subsequent trades use "Conservative" parameters (low slippage).

#### Scenario: Default profile
Given a new user configuration
When no profile is explicitly selected
Then the system defaults to the `MODERATE` profile.

### Requirement: Dynamic Execution Parameters

The execution engine MUST adjust trading parameters based on the active Strategy Profile.

#### Scenario: Conservative Slippage Check
Given a user with `CONSERVATIVE` profile (max slippage 0.5%)
And a trade signal with an estimated slippage of 1.0%
When the execution service processes the trade
Then the trade is rejected/skipped due to high slippage.

#### Scenario: Aggressive Slippage Allowance
Given a user with `AGGRESSIVE` profile (max slippage 5.0%)
And a trade signal with an estimated slippage of 3.0%
When the execution service processes the trade
Then the trade is executed successfully.
