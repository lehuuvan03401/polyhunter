# Pricing Reliability

## ADDED Requirements

### Requirement: Fallback to Gamma API

The system MUST ensure that a valid price is retrieved for every position, even if the primary CLOB data source is unavailable.

#### Scenario: CLOB API fails
- **Given** the CLOB API returns a 500 error or exception
- **And** the Gamma API returns valid market data with outcome prices
- **When** the Portfolio API constructs position data
- **Then** the `curPrice` MUST be derived from Gamma outcome prices
- **And** the `curPrice` MUST NOT default to `avgEntryPrice`

### Requirement: Live Prices in Simulation Summary

The simulation script MUST reflect real-world market conditions in its final summary report.

#### Scenario: Simulation Summary
- **Given** the simulation has run for a duration
- **When** the summary is printed
- **Then** the Unrealized PnL MUST be calculated using live market prices (if available)
- **And** MUST NOT assume current price equals entry price
