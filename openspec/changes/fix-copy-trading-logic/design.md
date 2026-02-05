# Design: Fix Copy Trading Logic

## Context
The system currently treats `copy-trading-worker` as a "Fleet Manager" that uses its own wallets (Proxy Operators) to execute trades for users via the Proxy contract. However, "Speed Mode" (EOA) requires the Worker to act as a **personal execution agent**, signing transactions *as the user* directly against the Exchange, bypassing the Proxy.

## Architectural Changes

### 1. User Execution Manager (Worker Side)
Instead of a singleton `TradingService`, the Worker will maintain a `UserExecutionManager`.

```typescript
class UserExecutionManager {
    private services: Map<string, TradingService> = new Map();

    async getService(walletAddress: string, config: WatchedConfig): Promise<TradingService> {
        // Return existing or create new
        // If config.executionMode === 'EOA', decrypt key and init TradingService with USER creds
        // If config.executionMode === 'PROXY', use Fleet Service (Global)
    }
}
```

### 2. Security Boundaries
*   **Decryption**: Occurs *only* inside the ephemeral memory of the `copy-trading-worker` process.
*   **Persistence**: Keys are never logged. `encryptedKey` is only decrypted when initializing the `TradingService`.

### 3. API Credential Handling
*   We will add `apiKey`, `apiSecret`, `apiPassphrase` (encrypted?) to `CopyTradingConfig`.
*   Ideally, these should also be encrypted like the Private Key.
*   **Decision**: For V1 of this fix, we will encrypt them using the same `EncryptionService`.

## Data Flow (Speed Mode)
1.  **User** enables Speed Mode, enters PK + API Keys in UI.
2.  **API** encrypts all secrets and saves to `CopyTradingConfig` (DB).
3.  **Worker** polls DB (`refreshConfigs`).
4.  **Worker** detects signal.
5.  **Worker** calls `UserExecutionManager.getService(user)`.
    *   Decrypts PK + API Keys.
    *   Instantiates `TradingService` (CLOB Client) with these specific credentials.
6.  **Worker** executes trade via this specific `TradingService` instance.

## Data Flow (Proxy Mode)
1.  **User** enables Proxy Mode.
2.  **API** saves config.
3.  **Worker** detects signal.
4.  **Worker** uses **Default Global Fleet Service** to execute `proxy.copyTrade()`.
