## ADDED Requirements
### Requirement: Execution Readiness Check
The system SHALL provide a non-interactive script to validate real copy-trading execution readiness.

#### Scenario: Readiness check passes
- **GIVEN** RPC is healthy, proxy exists, balances/allowances are sufficient, and guardrails allow execution
- **WHEN** the readiness script runs
- **THEN** it exits successfully and prints a ready status

#### Scenario: Readiness check fails
- **GIVEN** at least one prerequisite is missing
- **WHEN** the readiness script runs
- **THEN** it reports the missing requirement and exits with a non-zero status
