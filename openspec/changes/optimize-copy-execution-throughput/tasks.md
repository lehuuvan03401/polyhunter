## 1. Implementation
- [x] 1.1 Reduce signer mutex scope to on-chain tx submission only.
- [x] 1.2 Introduce async settlement queue (push/reimburse) with retries and idempotency.
- [x] 1.3 Add settlement queue metrics (depth, lag, retry counts).
- [x] 1.4 Update runbook with async settlement behavior and operational cautions.

## 2. Verification
- [ ] 2.1 Verify mutex scope does not block parallel CLOB orders.
- [ ] 2.2 Verify settlement queue processes deferred pushes and reimbursements.
- [ ] 2.3 Verify retries and failure logging for settlement errors.

## 3. Docs
- [x] 3.1 Document async settlement trade-offs and monitoring signals.
