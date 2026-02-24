## 1. Implementation
- [x] 1.1 Add guardrail checks in `processJob` before worker selection and queueing.
- [x] 1.2 Add guardrail re-check in `executeJobInternal` before order execution.
- [x] 1.3 Increment guardrail counters only after successful executions.

## 2. Verification
- [x] 2.1 Run type-check for `web` workspace.
- [x] 2.2 Validate OpenSpec change with strict mode.
