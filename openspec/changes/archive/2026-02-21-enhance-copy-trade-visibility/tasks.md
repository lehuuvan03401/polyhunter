# Tasks: Enhanced Copy Trade Visibility

- [ ] Create Prisma migration to add `originalTxHash` to `CopyTrade` <!-- id: 0 -->
- [ ] Update `CopyTrade` detection logic to capture `txHash` from Leader's event <!-- id: 1 -->
- [ ] Update `/api/copy-trading/orders` to include `leaderTxHash` in response <!-- id: 2 -->
- [ ] Update `useOrderStatus` hook `Order` interface with `leaderTxHash` <!-- id: 3 -->
- [ ] Update `OrderStatusPanel` to show Leader Tx Link (PolygonScan) <!-- id: 4 -->
- [ ] Update `OrderStatusPanel` to show Price Comparison (Leader vs User) <!-- id: 5 -->
- [ ] Verify links and data accuracy in local simulation <!-- id: 6 -->
