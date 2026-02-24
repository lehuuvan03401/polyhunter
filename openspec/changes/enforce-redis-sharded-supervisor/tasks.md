## 1. Implementation
- [x] 1.1 Enforce Redis requirement when `SUPERVISOR_SHARD_COUNT>1`.
- [x] 1.2 Throw startup error when Redis URL is missing in sharded mode.
- [x] 1.3 Throw startup error when Redis connection/init fails in sharded mode.
- [x] 1.4 Preserve in-memory fallback behavior for single-instance mode.

## 2. Verification
- [x] 2.1 Run web type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
