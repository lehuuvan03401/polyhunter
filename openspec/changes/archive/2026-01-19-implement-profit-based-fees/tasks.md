# Tasks: Implement Profit-Based Fee Logic

## 1. Data Model Updates
- [ ] Add `UserPosition` model to `schema.prisma` to track cost basis (avgEntryPrice) for each token/user. <!-- id: 1 -->
- [ ] Run migration/push to update DB. <!-- id: 2 -->

## 2. Implement Cost Basis Tracking
- [ ] Create `PositionService` to handle "Open Position" (Buy) updates (Weighted Average calculation). <!-- id: 3 -->
- [ ] Create `ProfitCalculator` to handle "Close Position" (Sell) updates and return Realized Profit. <!-- id: 4 -->

## 3. Update Affiliate Engine
- [ ] Implement `getFeeRate(cumulativeVolume)` tier logic in `AffiliateEngine`. <!-- id: 5 -->
- [ ] Update `distributeCommissions` to accept `realizedProfit` instead of `volume` as the fee basis. <!-- id: 6 -->
- [ ] Add check: `if (realizedProfit <= 0) return;` (No fee on loss). <!-- id: 7 -->

## 4. Integrate with Supervisor
- [ ] Update `copy-trading-supervisor.ts` to call `PositionService` on trades. <!-- id: 8 -->
- [ ] On Sell, calculate profit and pass to `AffiliateEngine`. <!-- id: 9 -->

## 5. Verification
- [ ] Verify that "Buy" actions update Cost Basis but charge NO fee. <!-- id: 10 -->
- [ ] Verify that "Sell" (Loss) actions charge NO fee. <!-- id: 11 -->
- [ ] Verify that "Sell" (Profit) actions charge fee based on Tier Rate. <!-- id: 12 -->
