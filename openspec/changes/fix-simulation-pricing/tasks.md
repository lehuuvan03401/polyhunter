# Tasks

- [x] Modify `frontend/app/api/copy-trading/positions/route.ts`
    - [x] Add error logging for CLOB orderbook fetching
    - [x] Implement fallback to Gamma API prices (using `outcomePrice`) when CLOB fails or returns 0
    - [x] Ensure `curPrice` reflects the best available data source
- [x] Modify `frontend/scripts/simulate-copy-trading.ts`
    - [x] Add basic price fetching (Gamma or CLOB) to `printSummary`
    - [x] Update Unrealized PnL calculation to use fetched prices
- [ ] Validation
    - [ ] Run `simulate-copy-trading.ts`
    - [ ] Verify CLI summary shows valid Net PnL (not 0% if prices moved)
    - [ ] Verify Dashboard (if running) shows different Entry vs Current prices
