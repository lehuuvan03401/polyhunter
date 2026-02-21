# Tasks: Implement Redemption Mechanism

## Simulation
- [x] Implement `processRedemptions` function in `simulate-copy-trading.ts` <!-- id: 1 -->
- [x] Update `Position` logic to remove redeemed positions from `dbPositions` <!-- id: 2 -->
- [x] Record `REDEEM` events in `CopyTrade` table for PnL tracking <!-- id: 3 -->
- [x] Verify `Total PnL` calculation handles redeemed cash properly <!-- id: 4 -->

## Real Trading (UI)
- [x] Create `useRedeem` hook wrapping `CTFExchange.redeemPositions` <!-- id: 5 -->
- [x] Update `Portfolio` table to show "Redeem" button for `SETTLED_WIN` positions <!-- id: 6 -->
- [x] Add toast notifications for transaction status <!-- id: 7 -->
