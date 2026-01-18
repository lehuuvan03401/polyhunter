<!--
    Implementation tasks for Fix Copy Trading Critical Issues
-->

- [x] Enable Price Fetching <!-- id: 0 -->
    - [x] Uncomment price fetch logic in `handleTransfer` <!-- id: 1 -->
    - [x] Add price caching to avoid redundant API calls <!-- id: 2 -->
    - [x] Add fallback handling for price fetch failures <!-- id: 3 -->
- [x] Integrate DebtManager on Failure <!-- id: 4 -->
    - [x] Call `debtLogger.logDebt()` when reimbursement fails in `executeOrderWithProxy` <!-- id: 5 -->
    - [x] Add debt recovery call in Supervisor startup <!-- id: 6 -->
- [x] Add Duplicate Trade Prevention <!-- id: 7 -->
    - [x] Create TTL cache for processed event hashes <!-- id: 8 -->
    - [x] Check cache before dispatching jobs in `handleTransfer` <!-- id: 9 -->
- [x] Add Position Balance Check for SELL <!-- id: 10 -->
    - [x] Query user's CTF token balance before SELL <!-- id: 11 -->
    - [x] Cap shares to sell at actual balance <!-- id: 12 -->
- [ ] Implement Filter Validation <!-- id: 13 -->
    - [ ] Add market data fetch for filter checks <!-- id: 14 -->
    - [ ] Validate `minLiquidity`, `minVolume`, `maxOdds` before execution <!-- id: 15 -->
    - [ ] Skip trade if filters not met, log reason <!-- id: 16 -->
- [x] Verification <!-- id: 17 -->
    - [x] Test price fetching with real market data <!-- id: 18 -->
    - [x] Test debt recording on simulated failure <!-- id: 19 -->
    - [x] Test duplicate event rejection <!-- id: 20 -->
