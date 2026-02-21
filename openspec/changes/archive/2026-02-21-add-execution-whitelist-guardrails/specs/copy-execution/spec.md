## ADDED Requirements
### Requirement: Execution Allowlist and Per-Trade Cap
The system SHALL restrict real execution to wallet addresses on an allowlist and SHALL reject any trade whose notional exceeds a configured per-trade cap.

#### Scenario: Wallet not allowlisted
- **GIVEN** real trading is enabled
- **AND** a trade is requested for a wallet not in the allowlist
- **WHEN** guardrails run
- **THEN** the trade is skipped with reason "ALLOWLIST_BLOCKED"

#### Scenario: Per-trade cap exceeded
- **GIVEN** a per-trade cap of 200 USDC
- **WHEN** a trade of 350 USDC is requested
- **THEN** the trade is skipped with reason "MAX_TRADE_EXCEEDED"
