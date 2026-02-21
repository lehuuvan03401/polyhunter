# Spec: Simulation Redemption

## ADDED Requirements

### Requirement: Automated Redemption of Winning Positions
The simulation engine MUST automatically convert settled winning positions into simulated cash to realize profits.

#### Scenario: Market Resolves to Winning Outcome
- **Given** the simulation tracks a position of 100 shares on "Up"
- **And** the market resolves to "Up" (Price = $1.00)
- **When** the `processRedemptions` cycle runs
- **Then** the 100 shares are removed from the portfolio
- **And** $100.00 USDC is credited to the simulated balance
- **And** a `REDEEM` trade record is created (Size: 100, Price: $1.00)

#### Scenario: Market Resolves to Losing Outcome
- **Given** the simulation tracks a position on "Down"
- **And** the market resolves to "Up"
- **Then** the position remains as "Expired" or is cleared (optional cleanup) but **NO** cash is credited.
