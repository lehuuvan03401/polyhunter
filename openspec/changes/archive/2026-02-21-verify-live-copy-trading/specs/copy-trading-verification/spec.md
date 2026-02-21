# Copy Trading Verification Spec Delta

## ADDED Requirements

### Requirement: Dry-Run Execution Mode
The Supervisor SHALL support a DRY_RUN mode where all trade detection and job dispatching occurs normally, but actual order execution is skipped. This mode is used for production verification without risking funds.

#### Scenario: Dry-run mode skips order execution
- GIVEN the environment variable `DRY_RUN=true` is set
- WHEN a copy trade signal is detected for a monitored trader
- THEN the Supervisor logs the execution decision with full details
- AND the order is NOT submitted to the CLOB API
- AND log shows "[DRY_RUN] Would execute: BUY 50 USDC of token X @ $0.45"

#### Scenario: Dry-run mode logs execution metrics
- GIVEN dry-run mode is enabled
- WHEN multiple copy trade signals are processed
- THEN the metrics summary still logs total detections and latency
- AND success rate reflects detection rate (not execution rate)

---

### Requirement: Live Verification Script
The system SHALL provide a verification script that monitors real mainnet trader activity and validates the copy trading detection pipeline without executing trades.

#### Scenario: Verification script monitors target trader
- GIVEN the script is configured with target trader address `0x63ce342161250d705dc0b16df89036c8e5f9ba9a`
- WHEN the trader executes a trade on Polymarket
- THEN the script detects the trade via WebSocket within 500ms
- AND logs trader address, token, side, size, and price

#### Scenario: Verification script reports detection latency
- GIVEN a trade is detected from WebSocket
- WHEN the trade processing completes
- THEN the script calculates detection latency (WebSocket timestamp vs local time)
- AND logs latency in milliseconds
