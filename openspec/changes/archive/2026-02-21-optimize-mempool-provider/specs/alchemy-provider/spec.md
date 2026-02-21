# Spec: Alchemy Mempool Provider

This spec defines the "Pro" mode implementation using Alchemy's Enhanced WebSocket APIs.

## ADDED Requirements

### Requirement: Alchemy Provider Logic
A new class `AlchemyMempoolProvider` SHALL implement `IMempoolProvider`.

#### Scenario: Enhanced Subscription
It must use `eth_subscribe` with `alchemy_pendingTransactions`.
- Parameter `toAddress`: Set to `CONTRACT_ADDRESSES.ctf` to filter server-side.
- Parameter `hashesOnly`: Set to `false` to receive full transaction objects.

#### Scenario: Zero Round-Trip
The provider must parse the incoming message directly as a Transaction object.
It MUST NOT call `getTransaction`.
It MUST decode the input data locally and emit the callback if `from` or `to` matches monitored traders.

#### Scenario: Fallback
If Alchemy API specific methods fail (e.g. on a non-Alchemy URL), it should log an error or fallback to Standard mode.
