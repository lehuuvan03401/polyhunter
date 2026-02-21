## ADDED Requirements

### Requirement: Emergency Pause
The system SHALL block all real executions when an emergency pause control is enabled and SHALL record a guardrail event describing the block.

#### Scenario: Emergency pause blocks execution
- **GIVEN** emergency pause is enabled
- **WHEN** an execution attempt is made
- **THEN** the execution is skipped
- **AND** a guardrail event is recorded with reason `EMERGENCY_PAUSE`

### Requirement: Execution Limits
The system SHALL enforce configurable execution limits including max trade size, per-wallet daily cap, global daily cap, max trades per time window, and optional per-market caps.

#### Scenario: Max trade size exceeded
- **GIVEN** max trade size is configured to $10
- **WHEN** a copy trade request is $25
- **THEN** the execution is blocked
- **AND** a guardrail event is recorded with reason `MAX_TRADE_EXCEEDED`

#### Scenario: Wallet daily cap exceeded
- **GIVEN** per-wallet daily cap is configured to $100
- **AND** the wallet has already executed $95 today
- **WHEN** a $10 execution is requested
- **THEN** the execution is blocked
- **AND** a guardrail event is recorded with reason `WALLET_DAILY_CAP_EXCEEDED`

#### Scenario: Max trades per window exceeded
- **GIVEN** max trades per 10 minutes is configured to 20
- **WHEN** the 21st execution attempt in that window occurs
- **THEN** the execution is blocked
- **AND** a guardrail event is recorded with reason `TRADE_RATE_LIMIT_EXCEEDED`

### Requirement: Execution Worker Allowlist
The system SHALL require that the active execution worker address is included in the allowlist when an allowlist is configured.

#### Scenario: Worker not in allowlist
- **GIVEN** a worker allowlist is configured
- **AND** the active worker address is not in the allowlist
- **WHEN** an execution is attempted
- **THEN** the execution is blocked
- **AND** a guardrail event is recorded with reason `WORKER_ALLOWLIST_BLOCKED`

### Requirement: Dry-Run Mode
The system SHALL support a dry-run mode that performs all guardrail checks and logging without submitting any on-chain transactions.

#### Scenario: Dry-run skips on-chain execution
- **GIVEN** dry-run mode is enabled
- **WHEN** a copy trade execution is requested
- **THEN** the system evaluates guardrails
- **AND** records a guardrail event with reason `DRY_RUN`
- **AND** no on-chain transaction is submitted
