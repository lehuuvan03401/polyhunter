# Spec: Standard Mempool Provider

This spec defines the "Free" mode implementation using standard JSON-RPC methods.

## ADDED Requirements

### Requirement: Standard Provider Logic
A new class `StandardMempoolProvider` SHALL implement `IMempoolProvider`.

#### Scenario: Legacy Behavior Preservation
It must replicate the exact logic of the current `MempoolDetector`:
1.  Listen to `provider.on("pending")`.
2.  Receive Transaction Hash.
3.  Call `provider.getTransaction(hash)`.
4.  Filter by `to === CTF_ADDRESS`.
5.  Decode Input Data.
6.  Emit if `from` or `to` matches monitored traders.

#### Scenario: Error Handling
Must gracefully handle `getTransaction` failures (null result) without crashing the stream.
