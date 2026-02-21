# Design: Affiliate MLM Engine

## Architecture

### 1. Data Model Strategy: Closure Table
To support efficient queries for "Zero Line" (Directs) and "Sun Line" (Sub-trees) across 15 generations, we will use a **Closure Table** approach alongside the standard Adjacency List (`sponsorId`).

**Table: `TeamClosure`**
- `ancestorId`: The upper-level member
- `descendantId`: The lower-level member
- `depth`: Distance between them (0 = self, 1 = direct child, etc.)

**Benefits**:
- Querying a sub-tree size: `SELECT COUNT(*) FROM TeamClosure WHERE ancestorId = X`
- Querying exact depth (Zero Line): `WHERE ancestorId = X AND depth = 1`
- Querying upline for commissions: `SELECT ancestorId FROM TeamClosure WHERE descendantId = Y ORDER BY depth ASC`

### 2. Commission Calculation Flow
Triggered on `TradeExecuted` or `FeeCollected` events (or T+1 batch job as per requirements).

**Zero Line Logic (Direct Referral)**:
- Traverse upline 5 generations.
- Apply generation-specific rates: Gen1 (25%), Gen2 (10%), Gen3 (5%)...
- Check `minimum_profit_threshold`.

**Sun Line Logic (Team Differential)**:
- Identify "Sun Lines" (Strong legs) based on criteria (Team Size > 50 OR Volume > 100k).
- Calculate "Team Differential Bonus": `(UplineRate - DownlineRate) * Volume`.
- Traverse upline until `max_generations` or `monthly_cap` is reached.

### 3. Tier Upgrade System
- Scheduled job (Daily/Real-time) checking:
  - Direct Recruit Count (`TeamClosure` depth=1)
  - Total Team Size (`TeamClosure` count)
  - Team Volume (Aggregated `ReferralVolume`)
- Auto-promotes user if criteria met.

### 4. API & Frontend
- New Dashboard utilizing the hierarchy data.
- "My Team" visualization (Tree or List view).
