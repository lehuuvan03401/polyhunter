# simulation-engine Delta

## ADDED Requirements

### Requirement: Realistic Modeling
The simulation MUST account for real-world inefficiencies to prevent over-optimistic PnL projections.

#### Scenario: Slippage Simulation
- **WHEN** calculating the entry price of a simulated trade
- **THEN** the system MUST apply a configurable `SlippagePenalty` (default 0.5%) to the execution price
- **TO** model orderbook depth consumption and competition.

#### Scenario: Cost Modeling
- **WHEN** calculating the final PnL
- **THEN** the system MUST deduct estimated Gas Fees and Proxy Fees from the gross profit
- **TO** reflect net realizable returns.
