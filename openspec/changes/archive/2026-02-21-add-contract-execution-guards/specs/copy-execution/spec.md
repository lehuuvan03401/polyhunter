## ADDED Requirements

### Requirement: On-Chain Target Allowlist
The system SHALL enforce an on-chain allowlist of target contracts for Proxy executions and for Executor forwards in proxy mode.

#### Scenario: Non-allowlisted target blocked
- **GIVEN** a target address is not in the Proxy allowlist
- **WHEN** an execution is submitted via the Executor
- **THEN** the Proxy MUST reject the call
- **AND** no on-chain state is modified

#### Scenario: Executor allowlist blocks forwarding
- **GIVEN** a target address is not in the Executor allowlist
- **WHEN** an execution is submitted via the Executor
- **THEN** the Executor MUST reject the call before forwarding

### Requirement: On-Chain Emergency Pause
The system SHALL provide an on-chain pause control that blocks Proxy execution while allowing deposits and withdrawals.

#### Scenario: Pause blocks execution
- **GIVEN** the execution pause is enabled
- **WHEN** an execution is submitted
- **THEN** the execution is rejected
- **AND** deposits/withdrawals remain available

### Requirement: Executor Binding
The system SHALL bind each Proxy to a designated Executor at creation time and SHALL only allow that Executor (or the owner) to execute trades; additional operators are not permitted.

#### Scenario: Non-bound executor blocked
- **GIVEN** a Proxy is bound to Executor A
- **WHEN** Executor B attempts to execute a trade
- **THEN** the Proxy MUST reject the call

### Requirement: Execution Address Validation
The system SHALL validate required contract addresses for the active chain before submitting on-chain execution.

#### Scenario: Missing executor address
- **GIVEN** the executor address is not configured for the active chain
- **WHEN** an execution attempt is initiated
- **THEN** the system MUST fail fast with a configuration error
