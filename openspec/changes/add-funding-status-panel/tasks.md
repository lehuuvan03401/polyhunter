## 1. Implementation
- [x] Add a readiness API route that returns balances/allowances + required actions for a wallet
- [x] Reuse execution service logic for proxy resolution and allowance checks
- [x] Add UI panel to show readiness status, balances, and actionable guidance
- [x] Auto-refresh readiness on an interval and after wallet changes
- [x] Log readiness-related guardrail triggers for observability

## 2. Tests
- [ ] Add basic API route tests for readiness response shape (if test harness exists)

## 3. Documentation
- [x] Update docs to describe readiness panel and required env vars
