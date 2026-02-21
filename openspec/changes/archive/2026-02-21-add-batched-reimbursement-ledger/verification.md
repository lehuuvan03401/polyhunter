# Verification: add-batched-reimbursement-ledger

## 2.1 Local fork: create ledger entries, flush batch reimbursement
- [x] Create ledger entries and flush a single reimbursement on local fork.
- **Evidence:** `npx tsx scripts/verify/reimbursement-ledger-flow.ts`
  - Output includes: `Created ledger entries ...`, `Flushing batch reimbursement: $3.00`, `Ledger batch settled ...`
  - TX hash: `0x22339ea4b2e10ef1d1cf5e635c3f0aab7c9461984d8ba451ee031c51cf9e50f2`

## 2.2 Retry/backoff on failure
- [ ] Force a ledger flush failure (e.g., remove worker allowlist) and confirm retryCount/nextRetryAt increments.
