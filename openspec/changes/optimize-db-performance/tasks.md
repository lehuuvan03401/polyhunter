# Tasks: Optimize Database Performance

- [x] **Specs & Design** <!-- id: 0 -->
    - [x] Create spec for Async Prewrite logic. <!-- id: 1 -->
    - [x] Create spec for Config Caching (optional/lightweight). <!-- id: 2 -->

- [x] **Implementation** <!-- id: 3 -->
    - [x] **Refactor Prewrite**: in `copy-trading-worker.ts`, make `prisma.copyTrade.create` fire-and-forget. <!-- id: 4 -->
    - [x] **Safeguard**: Implement `.catch()` logging for the background promise. <!-- id: 5 -->
    - [x] **Idempotency**: Verify in-memory `idempotencyKey` set/map is robust enough for the execution window. <!-- id: 6 -->

- [x] **Verification** <!-- id: 7 -->
    - [x] **Dry Run**: Run worker and verify trade logs appear *immediately* without waiting for DB. <!-- id: 8 -->
    - [x] **Data Integrity**: Verify `CopyTrade` records still appear in DB eventually. <!-- id: 9 -->
