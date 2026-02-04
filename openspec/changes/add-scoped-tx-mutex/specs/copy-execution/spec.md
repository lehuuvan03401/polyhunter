## ADDED Requirements
### Requirement: Scoped Transaction Serialization
The system SHALL serialize on-chain execution per signer to avoid nonce collisions while allowing parallel execution across distinct signers.

#### Scenario: Same signer serialized
- **GIVEN** two executions use the same worker signer
- **WHEN** they submit on-chain transactions
- **THEN** the transactions are serialized to avoid nonce collisions

#### Scenario: Different signers parallelized
- **GIVEN** two executions use different worker signers
- **WHEN** they submit on-chain transactions
- **THEN** the system allows parallel execution without waiting on a global mutex
