<!--
    This is a high-level list of tasks to implementing the checks.
    Remember to verify manually to ensure safe adoption.
-->

- [x] Define `IMempoolProvider` Interface <!-- id: 0 -->
    - [x] Create `src/core/mempool/types.ts` with interface definition
    - [x] Define `MempoolConfig` type
- [x] Implement `StandardMempoolProvider` <!-- id: 1 -->
    - [x] Refactor existing `MempoolDetector` logic into `src/core/mempool/standard-provider.ts`
    - [x] Ensure parity with current behavior (N+1 safety checks)
- [x] Implement `AlchemyMempoolProvider` <!-- id: 2 -->
    - [x] Create `src/core/mempool/alchemy-provider.ts`
    - [x] Implement `alchemy_pendingTransactions` subscription
    - [x] Handle `toAddress` filtering and payload parsing
- [x] Integration & Configuration <!-- id: 3 -->
    - [x] Update `MempoolDetector` (manager) to instantiate provider based on env
    - [x] Add `MEMPOOL_PROVIDER` key to `.env`
    - [x] Update `copy-trading-supervisor.ts` to use new Manager
- [x] Verification <!-- id: 4 -->
    - [x] Test Standard Mode on Localhost
    - [x] Test Alchemy Mode (if key available) or Mock
