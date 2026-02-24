## 1. Implementation
- [x] 1.1 Determine settled vs pending on successful orchestrator executions.
- [x] 1.2 Persist `SETTLEMENT_PENDING` for deferred/incomplete settlements and `EXECUTED` for settled trades.
- [x] 1.3 Ensure pending status writes a clear `errorMessage` marker and settled status clears it.

## 2. Verification
- [x] 2.1 Run SDK build/type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
