## 1. Implementation

- [ ] 1.1 Add runtime guards or tests proving automated execution originates from the supervisor authority runtime.
- [ ] 1.2 Refactor compatibility execution routes so they delegate to shared authority logic instead of maintaining an independent state machine.
- [ ] 1.3 Demote or gate the old `copy-trading-worker.ts` automatic execution path.
- [ ] 1.4 Update package scripts and operator docs to point to the supported runtime.
- [ ] 1.5 Add rollout flags/runbook notes for disabling deprecated automatic paths safely.
- [ ] 1.6 Verify that only one automatic runtime can execute a given copy-trade signal in production mode.
