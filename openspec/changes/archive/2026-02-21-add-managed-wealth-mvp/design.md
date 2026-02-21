## Context
Horus already has a robust copy-trading stack (agent templates, strategy configs, execution and monitoring). The missing layer is productization for less sophisticated users: users should choose a managed product instead of configuring tactical parameters.

## Goals / Non-Goals
- Goals:
  - Provide productized managed subscriptions with terms, expected return bands, and risk profiles.
  - Keep funds isolated per subscription (no pooled capital).
  - Support conservative guarantee backed by reserve fund accounting.
  - Reuse existing execution engine to reduce delivery time.
- Non-Goals:
  - Real-fund custody/settlement in MVP.
  - Third-party insurance integration.
  - Multi-strategy optimizer and dynamic rebalancer.

## Decisions
- Decision: Ship MVP as simulated managed wealth, integrated with existing copy-trading execution.
  - Why: Fastest path to validate UX, pricing/risk display, and lifecycle operations.
- Decision: Conservative-only guarantee with reserve-fund ledger.
  - Why: Limits guarantee exposure and keeps model auditable.
- Decision: High-water-mark fee charging.
  - Why: Prevents double charging and aligns with portfolio product norms.
- Decision: Transparency by default, optional delayed details policy.
  - Why: Preserves user trust while allowing strategy IP protection where needed.

## Architecture
1. Product layer
- `ManagedProduct`, `ManagedTerm`, and product-agent mapping define sellable products.

2. Subscription layer
- `ManagedSubscription` stores user principal, term, state machine (`PENDING`, `RUNNING`, `MATURED`, `SETTLED`, `CANCELLED`).

3. Execution integration
- Each running subscription is mapped to isolated execution config(s) in existing copy-trading service.

4. NAV and risk layer
- Snapshot worker computes NAV and drawdown; risk engine emits `ManagedRiskEvent` and applies guardrail actions.

5. Settlement layer
- Maturity job computes gross PnL, HWM performance fee, guarantee shortfall, and net payout; writes immutable settlement record.

6. Reserve fund ledger
- Explicit credits/debits for guarantee operations; coverage threshold controls guarantee product availability.

## Data Flow
1. Subscribe
- User selects product + term -> API validates eligibility and reserve policy -> create `ManagedSubscription` -> map execution config.

2. Run
- Execution trades occur in existing pipeline -> NAV worker updates snapshots -> UI renders metrics and details per disclosure policy.

3. Mature & settle
- Scheduler marks matured subscriptions -> settlement engine computes final values -> reserve fund adjustment (if needed) -> finalize record.

## Settlement Formula (MVP)
- `grossPnl = finalEquity - principal`
- `hwmEligibleProfit = max(0, finalEquity - highWaterMark)`
- `performanceFee = hwmEligibleProfit * feeRate`
- `preGuaranteePayout = principal + grossPnl - performanceFee`
- For conservative guarantee products:
  - `guaranteedPayout = principal * (1 + minYieldRate)`
  - `reserveTopup = max(0, guaranteedPayout - preGuaranteePayout)`
  - `finalPayout = preGuaranteePayout + reserveTopup`
- For non-guaranteed products:
  - `reserveTopup = 0`
  - `finalPayout = preGuaranteePayout`

## Risks / Trade-offs
- Risk: Guarantee liability can exceed reserve in volatile periods.
  - Mitigation: Coverage ratio check + automatic pause for new guaranteed subscriptions.
- Risk: Simulated performance can be misunderstood as real-world certainty.
  - Mitigation: Strong disclosure labels and separate simulation badges in UI.
- Risk: Productization adds complexity to copy-trading operations.
  - Mitigation: Strict isolation per subscription and idempotent lifecycle jobs.

## Migration Plan
1. Add schema + migration + seeds behind feature flag.
2. Enable internal-only API routes and ops controls.
3. Run one full simulated term cycle in staging.
4. Enable production simulation for whitelisted users.
5. Evaluate real-fund phase as separate proposal.

## Open Questions
- Exact fee schedule by strategy and term (to be finalized by product owner).
- Reserve coverage threshold defaults (e.g., 120% / 150%).
- Early redemption policy in MVP (allow vs disallow) for fixed terms.
