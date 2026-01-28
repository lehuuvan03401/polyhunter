## ADDED Requirements
### Requirement: Proxy Allowance Precheck
The system SHALL verify proxy allowances before executing copy trades. BUY orders MUST verify USDC allowance from Proxy to Executor/Operator, and SELL orders MUST verify CTF approval for the Executor/Operator.

#### Scenario: BUY allowance missing
- **GIVEN** a copy trade BUY is about to execute
- **AND** the proxy USDC allowance for the Executor/Operator is zero
- **WHEN** the preflight checks run
- **THEN** the trade is skipped with an explicit "ALLOWANCE_MISSING" reason

#### Scenario: SELL approval missing
- **GIVEN** a copy trade SELL is about to execute
- **AND** the proxy has not approved the Executor/Operator for CTF transfers
- **WHEN** the preflight checks run
- **THEN** the trade is skipped with an explicit "ALLOWANCE_MISSING" reason
