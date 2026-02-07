## 1. Implementation
- [x] 1.1 Add `ReimbursementLedger` model and migration (proxy, bot, trade, amount, status, retryCount/nextRetryAt, timestamps).
- [x] 1.2 Record ledger entries when float is used and ledger batching is enabled.
- [x] 1.3 Add ledger flush loop to batch reimbursements by proxy/bot with retry + backoff.
- [x] 1.4 Enforce outstanding-float cap; fall back to proxy-pull path when cap exceeded.
- [x] 1.5 Add metrics for ledger depth, age, outstanding amount, and flush outcomes.
- [x] 1.6 Update runbook/env docs with ledger settings and monitoring guidance.
- [x] 1.7 Add verification script for batched reimbursements on local fork.
