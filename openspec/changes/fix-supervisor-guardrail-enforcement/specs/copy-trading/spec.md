## ADDED Requirements
### Requirement: Supervisor Execution Guardrails
The Supervisor SHALL enforce execution guardrails before queue admission and again immediately before execution for every copy-trade job.

#### Scenario: Block disallowed job before queueing
- **GIVEN** a copy-trade job is created for a wallet
- **AND** guardrail policy rejects it (for example `EMERGENCY_PAUSE`, `DRY_RUN`, allowlist, or cap limit)
- **WHEN** `processJob` evaluates the job
- **THEN** the job is not queued or executed
- **AND** the rejection reason is logged and persisted as a guardrail event

#### Scenario: Re-check guardrail after queue delay
- **GIVEN** a job passed initial checks and was queued
- **AND** guardrail state changes before execution (for example caps are reached)
- **WHEN** `executeJobInternal` starts execution
- **THEN** the job is rejected before order placement
- **AND** the rejection is recorded as a guardrail event

### Requirement: Guardrail Counter Consistency
The Supervisor SHALL update guardrail counters only after successful execution using the final executed notional amount.

#### Scenario: Increment counters after success
- **GIVEN** a job passes guardrails and executes successfully
- **WHEN** the execution result returns success
- **THEN** global, wallet, market, and window counters are incremented
- **AND** future guardrail checks use the updated counters
