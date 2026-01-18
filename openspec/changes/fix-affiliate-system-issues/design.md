# Design: Affiliate System Fixes

## Context
The affiliate system was implemented in `implement-comprehensive-affiliate-system` but several core features were incomplete:
- Tier auto-upgrade (mentioned in design.md but not implemented)
- Volume tracking (schema exists but not written to)
- Payout security (API accepts unauthenticated requests)

## Goals
- Complete the missing tier upgrade automation
- Fix volume tracking to enable proper tier progression
- Secure the payout endpoint against impersonation attacks
- Improve API performance with pagination

## Non-Goals
- Changing the commission calculation algorithms (already correct)
- Modifying the Closure Table structure (already correct)
- Redesigning the frontend UI

## Decisions

### Decision 1: Tier Upgrade Location
**Choice**: Trigger tier check at end of `distributeCommissions()` rather than scheduled job.
**Rationale**: Real-time feedback; simpler architecture; user sees immediate upgrade. Scheduled jobs can be added later if batch processing becomes necessary.

### Decision 2: Payout Signature Verification
**Choice**: Use EIP-191 personal_sign message verification.
**Rationale**: Standard approach; compatible with all major wallets; already using ethers.js which supports this.

### Decision 3: Volume Tracking Scope
**Choice**: Track volume at three levels - `Referral.lifetimeVolume`, `Referrer.totalVolume`, and cascade `teamVolume` up the tree.
**Rationale**: Enables tier upgrade calculations and provides accurate analytics. Closure table makes cascade efficient.

## Risks / Trade-offs
- **Cascade volume update performance**: For deep trees, updating all ancestors' `teamVolume` could be slow.
  - *Mitigation*: Limit cascade depth to 15 (same as commission), use batch transaction.
- **Signature verification UX**: Requires user to sign message before withdrawal.
  - *Mitigation*: Clear UI messaging explaining security purpose.

## Open Questions
None - all decisions are straightforward implementations of originally designed features.
