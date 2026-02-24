## 1. Implementation
- [x] 1.1 Add supervisor settlement recovery scheduler and feature flags.
- [x] 1.2 Add claim-lock flow for `SETTLEMENT_PENDING` rows to avoid duplicate processing across instances.
- [x] 1.3 Execute settlement recovery via execution service and persist status transitions (`EXECUTED` / retry / `FAILED`).
- [x] 1.4 Emit settlement recovery metrics for Prometheus and periodic summary logs.

## 2. Verification
- [x] 2.1 Run web type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
