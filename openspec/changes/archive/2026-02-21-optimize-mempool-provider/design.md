# Design: Mempool Provider Abstraction

## Architecture
We will move from a monolithic `MempoolDetector` class to a Strategy Pattern.

### Components

1.  **`IMempoolProvider` (Interface)**
    *   `start()`: void
    *   `stop()`: void
    *   `updateMonitoredTraders(Set<string>)`: void
    *   `onTransaction(callback)`: void

2.  **`MempoolManager` (Factory/Facade)**
    *   Reads `MEMPOOL_PROVIDER` env var.
    *   Instantiates appropriate provider.
    *   Exposes same API as current `MempoolDetector` to minimize consumer changes.

3.  **`StandardMempoolProvider` (Concrete Strategy A)**
    *   Legacy logic.
    *   `provider.on("pending", txHash => ...)`
    *   Suitable for Localhost and Generic RPCs.

4.  **`AlchemyMempoolProvider` (Concrete Strategy B)**
    *   Optimized logic.
    *   `provider.send("eth_subscribe", ["alchemy_pendingTransactions", ...])`
    *   Zero round-trip latency.

## Data Flow

**Standard:**
RPC -> "pending" (Hash) -> `StandardProvider` -> GetTx(Hash) -> Filter(CTF) -> Decode -> Callback

**Alchemy:**
Alchemy -> Subscription (Full Tx, Pre-filtered by CTF) -> `AlchemyProvider` -> Decode -> Callback

## Configuration
New Environment Variable:
`MEMPOOL_PROVIDER`: "STANDARD" (default) or "ALCHEMY"
`NEXT_PUBLIC_ALCHEMY_API_KEY`: Required for Alchemy mode.
