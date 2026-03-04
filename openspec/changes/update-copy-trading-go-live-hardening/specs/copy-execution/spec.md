## ADDED Requirements

### Requirement: Execution Outcome Classification Must Match Persisted Trade State
The execution layer SHALL classify successful executions consistently across execution modes and align returned outcome signals with persisted trade status.

#### Scenario: EOA success without transaction hash is still executed
- **GIVEN** an EOA execution succeeds and returns an `orderId` but no on-chain transaction hash
- **WHEN** the orchestrator finalizes the trade
- **THEN** the trade is persisted as successful (`EXECUTED` or `SETTLEMENT_PENDING` as applicable)
- **AND** the orchestrator returns `executed=true` to supervisor callers

#### Scenario: Success classification includes settlement semantics
- **GIVEN** a proxy execution succeeds but settlement transfer is deferred or incomplete
- **WHEN** final status is computed
- **THEN** status is `SETTLEMENT_PENDING`
- **AND** callers receive a success classification consistent with that persisted state

### Requirement: No Orphan Pending Trades After Execution Attempt
Once a trade is created for execution, the system SHALL guarantee deterministic state closure for all error paths.

#### Scenario: Exception after trade creation transitions to terminal state
- **GIVEN** a `CopyTrade` row is created and an exception occurs before normal finalization
- **WHEN** error handling runs
- **THEN** the trade transitions to `FAILED` or explicit retry state with retry metadata
- **AND** the trade does not remain indefinitely in `PENDING`

#### Scenario: Execution timeout or downstream failure is recoverable and visible
- **GIVEN** downstream execution components fail or time out
- **WHEN** the execution attempt ends
- **THEN** the trade records explicit failure context (error/retry fields)
- **AND** operational monitors can distinguish retriable versus terminal failures
