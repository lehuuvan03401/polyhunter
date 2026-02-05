# Optimize Database Performance

## Problem
The current copy trading worker performs synchronous database operations in its critical execution path:
1.  **Prewrite Blocking**: `prisma.copyTrade.create` is awaited before every trade execution attempt, adding significant "tick-to-trade" latency.
2.  **Redundant Reads**: `refreshConfigs` fetches all active configurations from the database every cycle, creating unnecessary load.

## Solution
1.  **Async Prewrite (Fire-and-Forget)**: Decouple database recording from trade execution. Use in-memory idempotency checks and persist records in the background.
2.  **Config Caching**: Implement a read-through cache for copy trading configurations using the existing `UnifiedCache` (in-memory) to reduce database polling.

## Risks
*   **Data Loss on Crash**: If the worker crashes before the background write completes, the `CopyTrade` record might be lost (though the on-chain tx would exist). We accept this tradeoff for execution speed.
*   **Cache Staleness**: Config updates might have a slight delay (TTL) before being picked up by the worker. We will set a short TTL (e.g., 5-10s) or implement a manual invalidation trigger if needed.
