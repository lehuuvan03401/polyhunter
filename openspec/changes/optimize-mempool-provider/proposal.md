# Optimization: Mempool Provider Strategy

The current `MempoolDetector` uses a naive polling strategy (on 'pending' event -> getTransaction) which suffers from N+1 query performance issues and high latency. This change introduces a modular "Provider Strategy" pattern, allowing the system to switch between a standard "Free" mode (existing logic) and a high-performance "Alchemy" mode (using Alchemy's Enhanced WebSocket APIs for server-side filtering and full transaction push).

## Why
- **Scalability**: The current N+1 approach will hit RPC rate limits immediately as volume grows.
- **Latency**: Double round-trip (Hash -> GetTx) misses fast-moving blocks.
- **Flexibility**: Users should be able to start for free (Standard) and upgrade to Pro (Alchemy) without code changes.

## What Changes
1.  **Abstract `MempoolProvider`**: Create an interface for mempool detection.
2.  **`StandardMempoolProvider`**: Encapsulate existing logic (listen to pending -> fetch tx).
3.  **`AlchemyMempoolProvider`**: Implement Alchemy's `alchemy_pendingTransactions` subscription which pushes full transaction bodies filtered by `toAddress`, eliminating round-trips.
4.  **Configuration**: Add `MEMPOOL_PROVIDER=STANDARD|ALCHEMY` to `.env`.
