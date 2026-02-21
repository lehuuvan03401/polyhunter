# Tasks: Verify Live Copy Trading

## 1. Setup & Verification Infrastructure
- [x] 1.1 Create `scripts/verify-live-copy-trading.ts` with WebSocket connection to mainnet activity
- [x] 1.2 Add environment validation for mainnet RPC (Polygon)
- [x] 1.3 Implement dry-run config seeding for target trader `0x63ce342161250d705dc0b16df89036c8e5f9ba9a`

## 2. Implement DRY_RUN Mode in Supervisor
- [x] 2.1 Add `DRY_RUN` environment variable check in `copy-trading-supervisor.ts`
- [x] 2.2 Skip actual order execution when dry-run is enabled
- [x] 2.3 Log full execution decision details (size, price, slippage) instead

## 3. Run Live Verification
- [x] 3.1 Start supervisor in DRY_RUN mode on mainnet
- [x] 3.2 Monitor target trader activity for at least 5 minutes
- [x] 3.3 Verify trade detection via WebSocket (expect <500ms latency)
- [x] 3.4 Confirm job dispatching for each detected trade
- [x] 3.5 Document any issues found

## 4. Fix Discovered Issues
- [x] 4.1 Fix any WebSocket connection issues (none found)
- [x] 4.2 Fix any trade parsing/filtering issues (none found)
- [x] 4.3 Fix any latency issues (none found)

## 5. Verification & Documentation
- [x] 5.1 Capture sample log output from successful detection
- [x] 5.2 Update operations documentation with live verification results
- [x] 5.3 Create walkthrough with proof of successful detection
