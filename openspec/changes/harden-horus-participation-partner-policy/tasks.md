## 1. Partner hard-cap and governance automation
- [ ] 1.1 Remove mutable seat-cap behavior; enforce immutable global cap = 100 in config and seat allocation paths.
- [ ] 1.2 Add month-end elimination scheduler entrypoint (idempotent by `monthKey`).
- [ ] 1.3 Add refund SLA watchdog for overdue pending refunds and alert hooks.
- [ ] 1.4 Add/adjust tests for seat-cap immutability, month-end scheduling idempotency, and SLA breach detection.

## 2. Participation authorization hardening
- [ ] 2.1 Make managed activation gate production-default mandatory (`ACTIVE + MANAGED + qualified funding`).
- [ ] 2.2 Make managed custody authorization production-default mandatory before managed subscription creation.
- [ ] 2.3 Add regression tests for hard gate behavior and downgrade bypass prevention.

## 3. Incentive and fee policy closure
- [ ] 3.1 Enable same-level bonus settlement as production-default policy and add startup/config validation.
- [ ] 3.2 Audit fee paths; enforce explicit scope for fixed 20% realized-profit policy and prevent ambiguous double-charging routes.
- [ ] 3.3 Add tests for no-profit-no-fee, fixed 20% settlement, and fee-scope isolation.

## 4. FREE-mode boundary enforcement
- [ ] 4.1 Add explicit FREE-mode non-custodial execution guardrails at API boundary.
- [ ] 4.2 Reject managed/custodial-only flows when account is not in `MANAGED` mode.
- [ ] 4.3 Add integration tests for FREE/MANAGED mode cross-boundary rejection.

## 5. Operations and rollout
- [ ] 5.1 Update operations runbook for scheduler cadence, SLA handling, and incident escalation.
- [ ] 5.2 Add release gates and verification checklist for policy-hardening rollout.
- [ ] 5.3 Run `openspec validate harden-horus-participation-partner-policy --strict --no-interactive`.
