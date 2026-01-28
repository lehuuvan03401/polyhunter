## ADDED Requirements
### Requirement: Execution Guardrails
The system MUST gate real-money execution behind explicit configuration flags and enforce per-wallet and global daily caps.

#### Scenario: Global execution disabled
- GIVEN `ENABLE_REAL_TRADING` is false
- WHEN a real trade is ready for execution
- THEN the system MUST skip execution
- AND record the trade as "blocked by guardrail"

#### Scenario: Per-wallet daily cap reached
- GIVEN a wallet has reached its daily execution cap
- WHEN another trade is prepared for that wallet
- THEN the system MUST skip execution
- AND record the trade as "daily cap reached"

### Requirement: Execution Metadata Persistence
The system MUST persist execution metadata required for recovery, including whether bot float was used.

#### Scenario: Persist usedBotFloat
- GIVEN a trade was executed using bot float
- WHEN the execution completes
- THEN the CopyTrade record MUST store `usedBotFloat=true`
- AND recovery uses this value to determine reimbursement behavior
