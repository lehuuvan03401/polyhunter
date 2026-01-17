# Tasks: Implement Execution Modes

- [ ] 1. Backend: Core Logic Support <!-- id: 1 -->
    - [ ] 1.1 Update `ActiveConfig` interface & Schema to support `mode` and `encryptedKey`. <!-- id: 2 -->
    - [ ] 1.2 Implement `EncryptionService` (Simple AES) for local key storage. <!-- id: 3 -->
    - [ ] 1.3 Refactor `CopyTradingExecutionService` to support `EOA` mode (skip proxy steps). <!-- id: 4 -->

- [ ] 2. Supervisor Integration <!-- id: 5 -->
    - [ ] 2.1 Update `Supervisor` to decrypt keys for EOA users. <!-- id: 6 -->
    - [ ] 2.2 Update `Supervisor` to instantiate correct `Signer` (Worker vs User EOA). <!-- id: 7 -->

- [ ] 3. Frontend Implementation <!-- id: 8 -->
    - [ ] 3.1 Create `ModeSelector` component. <!-- id: 9 -->
    - [ ] 3.2 Add "Speed Mode" setup form (Private Key Input). <!-- id: 10 -->
    - [ ] 3.3 Integrate with Backend API to save Config. <!-- id: 11 -->

- [ ] 4. Verification <!-- id: 12 -->
    - [ ] 4.1 Test `Security Mode` (Regression Test). <!-- id: 13 -->
    - [ ] 4.2 Test `Speed Mode` (Direct Execution). <!-- id: 14 -->
