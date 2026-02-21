# Fix Copy Trading Logic Disconnects

**change-id**: `fix-copy-trading-logic`
**status**: `draft`

## Summary
Address critical logical disconnects in the Copy Trading execution pipeline, specifically regarding "Speed Mode" (EOA) private key usage and the lack of per-user API credentials. This change ensures that the frontend configuration for Speed Mode is correctly respected by the backend worker, enabling true non-custodial (or correctly authorized custodial) execution for advanced users.

## Problem Statement
The current implementation allows users to configure "Speed Mode" (EOA execution) and input private keys in the frontend, which are securely stored. However, the backend worker (`copy-trading-worker.ts`) completely ignores these configurations, using a global "Fleet" wallet for all executions. Additionally, all trades share a single global API key, posing rate-limit risks and attribution issues for high-frequency trading.

## Proposed Solution
1.  **Worker Logic Update**: Refactor `copy-trading-worker.ts` to read encrypted private keys from the database, decrypt them in memory, and use the specific user's signer for EOA-mode trades.
2.  **API Credentials**: Extend the database schema and worker logic to support per-user Polymarket API credentials (Key/Secret/Passphrase), ensuring distinct rate limits and proper trade attribution.
3.  **Frontend Alignment**: Ensure the "Speed Mode" UI explicitly collects necessary API credentials if not already present, or clarify the limitations.

## Impact
-   **Reliability**: "Speed Mode" will actually work as intended.
-   **Trust**: Users providing private keys will see them used correctly (or we should remove the feature).
-   **Scalability**: Per-user API keys prevent global rate limit bottlenecks.

## Risks
-   **Security**: Decrypting user private keys in the Worker memory requires strict handling. The Worker environment must be secure.
-   **Complexity**: Managing multiple `TradingService` instances (one per user) increases memory usage and complexity compared to a singleton.
