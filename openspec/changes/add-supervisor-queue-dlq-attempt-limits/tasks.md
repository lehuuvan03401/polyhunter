## 1. Implementation
- [x] 1.1 Add queue max-attempt configuration and enforce attempt increments on nack/reclaim paths.
- [x] 1.2 Add DLQ storage in memory and Redis queue stores.
- [x] 1.3 Move exhausted jobs to DLQ instead of requeueing indefinitely.
- [x] 1.4 Add DLQ metrics (`dead_lettered`, `dlq_size`) and alert threshold wiring.

## 2. Verification
- [x] 2.1 Run web type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
