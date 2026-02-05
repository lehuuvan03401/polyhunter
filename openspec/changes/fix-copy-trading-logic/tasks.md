# Tasks: Fix Copy Trading Logic

- [x] **Schema & API Updates** <!-- id: 0 -->
    - [x] Update `schema.prisma` to include `apiKey`, `apiSecret`, `apiPassphrase` in `CopyTradingConfig`. <!-- id: 1 -->
    - [x] Migrate database to apply schema changes. <!-- id: 2 -->
    - [x] Update `api/copy-trading/config/route.ts` to accept and validate new API credential fields. <!-- id: 3 -->

- [x] **Worker Logic Refactor** <!-- id: 4 -->
    - [x] Update `copy-trading-worker.ts` to fetch `encryptedKey`, `iv`, and API creds in `refreshConfigs()`. <!-- id: 5 -->
    - [x] Implement `UserExecutionManager` to handle user-specific `TradingService` instances. <!-- id: 6 -->
    - [x] Refactor `executeCopyTrade` (or calling logic) to use `TradingService` for EOA mode users. <!-- id: 7 -->
    - [x] Add decryption logic using `EncryptionService` within the secure worker context. <!-- id: 8 -->
    - [x] Add EOA-specific preflight + guardrails without proxy dependency. <!-- id: 12 -->
    - [x] Apply per-user limiter for EOA and keep global cap as separate circuit breaker. <!-- id: 13 -->
    - [x] Use per-user API credentials for proxy-mode CLOB calls when provided. <!-- id: 14 -->
    - [x] Redact encrypted secrets from config API responses. <!-- id: 15 -->

- [ ] **Verification** <!-- id: 9 -->
    - [ ] Verify "Speed Mode" trade executes with User's Private Key (check logs/tx sender). <!-- id: 10 -->
    - [ ] Verify "Proxy Mode" continues to work with Fleet Wallets. <!-- id: 11 -->
