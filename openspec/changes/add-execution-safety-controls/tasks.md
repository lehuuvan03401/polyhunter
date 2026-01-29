## 1. Implementation
- [x] Add guardrail env configs to `.env.example` and docs
- [x] Extend guardrail checks with emergency pause, worker allowlist, trade-rate limits, per-market caps, and dry-run flag
- [x] Persist guardrail triggers in storage (Prisma model + migration)
- [x] Wire guardrail persistence into execution paths (worker + API execution)
- [x] Add lightweight retrieval path for recent guardrail events (admin endpoint or script)

## 2. Verification
- [x] Add/adjust tests for guardrail evaluation and persistence
- [ ] Validate guardrail events appear when limits are violated
- [ ] Confirm dry-run mode blocks execution while logging guardrail events
