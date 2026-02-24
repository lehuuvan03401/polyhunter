## 1. Implementation
- [x] 1.1 Add load-shedding mode state and threshold configuration.
- [x] 1.2 Evaluate load state from queue depth and p95 lag with recovery hysteresis.
- [x] 1.3 Apply dynamic fanout limits to dispatch fanout paths.
- [x] 1.4 Pause mempool dispatch when load-shedding mode requires it.
- [x] 1.5 Add periodic load-shedding evaluation loop and transition logs.
- [x] 1.6 Wire mempool detector callback into mempool execution handler.

## 2. Verification
- [x] 2.1 Run web type-check.
- [x] 2.2 Validate OpenSpec change with strict mode.
