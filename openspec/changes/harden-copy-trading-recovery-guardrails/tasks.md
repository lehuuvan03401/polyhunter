## 1. Implementation

- [ ] 1.1 Add stale `PENDING` expiration for supervisor/orchestrator-created trades.
- [ ] 1.2 Persist deferred reimbursement ledger entries from the authority runtime when reimbursement is postponed.
- [ ] 1.3 Add supervisor-owned ledger flush/retry processing with lock safety and metrics.
- [ ] 1.4 Add supervisor-owned market resolution / redemption follow-up for open copied positions.
- [ ] 1.5 Introduce guardrail reservation semantics for concurrent dispatch/execution.
- [ ] 1.6 Add verification coverage for expiration, ledger retry, settlement recovery, market resolution, and reservation release paths.
