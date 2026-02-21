
# Tasks: Implement Strategy Profiles

## Database & Model
- [x] Update `schema.prisma` to include `StrategyProfile` enum and add `strategyProfile` field to `CopyTradingConfig`.
- [x] Run `npx prisma db push` (or migration) to apply changes.

## Backend Implementation
- [x] Create `src/config/strategy-profiles.ts` to define the parameters for each profile.
- [x] Update `CopyTradingExecutionService` (or the Worker) to read `strategyProfile` and load parameters.
- [x] Update `CopyTradingExecutionService.executeCopyTrade` to accept and use these dynamic parameters (specifically `maxSlippage`).

## Frontend Implementation
- [x] Update `ProxyDashboard` component (and `ProxyActionCenter`) to include the Strategy Selection UI.
- [x] Connect UI to `updateConfig` API endpoint (API updated, UI pending).

## Verification
- [x] Verify database schema update.
- [x] Verify that changing profile in UI updates the DB.
- [x] Verify (via logs/simulation) that "Conservative" profile rejects trades with high slippage.
- [x] Verify `npm run build` succeeds (Type Safety Check).
