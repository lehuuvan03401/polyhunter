# Spec: Provider Abstraction

This spec defines the interface and factory pattern for decoupling mempool detection logic.

## MODIFIED Requirements

### Requirement: Mempool Manager Architecture
The existing `MempoolDetector` class SHALL act as a facade or factory, delegating actual listening logic to an implementation of `IMempoolProvider`.

#### Scenario: Interface Definition
The `IMempoolProvider` interface must support:
- Starting and stopping the listener.
- Updating the set of monitored traders dynamically.
- Emitting detected transactions via a standard callback callback.

#### Scenario: Factory Instantiation
`MempoolDetector` (or `MempoolManager`) must select the provider implementation based on the `MEMPOOL_PROVIDER` environment variable.
- If `MEMPOOL_PROVIDER=ALCHEMY`, instantiate `AlchemyMempoolProvider`.
- Default to `StandardMempoolProvider`.
