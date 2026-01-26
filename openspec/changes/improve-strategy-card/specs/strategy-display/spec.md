# Strategy Display Spec

## MODIFIED Requirements

### Requirement: detailed-strategy-info
The user MUST be able to see the configuration details of their active strategies to verify their risk and execution settings.

#### Scenario: Viewing Active Strategies
Given a user has an active copy trading strategy
When they view the Portfolio page
Then the Strategy Card MUST display:
  - The Trader Name and Address
  - The Copy Mode (Fixed/Percentage) and Amount/Scale
  - The Execution Mode (Proxy vs EOA)
  - The Automation Status (Auto vs Manual)
  - The Max Trade Limit
  - The Slippage Setting
