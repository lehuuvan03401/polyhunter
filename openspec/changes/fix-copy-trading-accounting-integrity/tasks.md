## 1. Implementation

- [ ] 1.1 Add failing tests for partial SELL cost-basis behavior and API/server execution ledger consistency.
- [ ] 1.2 Introduce or extract a shared position accounting writer for BUY/SELL updates.
- [ ] 1.3 Replace orchestrator ad hoc position SQL with the shared accounting path.
- [ ] 1.4 Update execute API to use the same accounting/PnL semantics as supervisor-driven execution.
- [ ] 1.5 Add reconciliation/backfill tooling or documented repair steps for historical `UserPosition.totalCost` drift.
- [ ] 1.6 Run targeted verification for BUY/SELL ledger updates and PnL consistency.
