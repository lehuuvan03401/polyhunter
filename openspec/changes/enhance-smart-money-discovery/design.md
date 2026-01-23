# Design: Enhanced Smart Money Discovery

## Context

Users want to discover copy-worthy traders from multiple sources:
1. **Top Performers** (Leaderboard) - High PnL/volume traders visible on Polymarket
2. **Rising Stars** (Active Traders API) - Traders with strong scientific metrics who may not yet be on leaderboard

**Stakeholders**: Copy traders seeking diverse trader discovery

**Constraints**:
- Must not break existing "Top Performers" functionality
- Page load time should remain fast
- Clear visual distinction between data sources

## Goals / Non-Goals

### Goals
- Provide dual data sources on Smart Money page
- Allow users to see or switch between both trader pools
- Display consistent scientific metrics for both

### Non-Goals
- Merging/deduping traders (will show separately to maintain data source clarity)
- Real-time updates
- Complex filtering/sorting options

## Decisions

### Decision 1: UI Pattern

**Chosen Approach**: Tabbed interface with "Top Performers" (default) and "Rising Stars" tabs

**Alternatives Considered**:
- Side-by-side sections - rejected: too crowded on mobile
- Single merged list - rejected: unclear data provenance
- Dropdown selector - rejected: tabs provide better UX

### Decision 2: Data Fetching

**Chosen Approach**: 
- "Top Performers": Keep existing SDK-based `polyClient.smartMoney.getSmartMoneyList()`
- "Rising Stars": Use `/api/traders/active` with default 30-day period

**Rationale**: Reuse existing proven endpoints, no new API needed

### Decision 3: Shared Metrics Display

Both sections should display:
- Rank, Name/Address
- PnL, Volume
- Scientific Score
- Profit Factor*, Max Drawdown*, Win Rate*

*Note: For "Top Performers", these metrics may not be available (marked as "limited data")

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Duplicate traders in both tabs | Low | Acceptable - shows different scoring perspectives |
| "Rising Stars" has fewer traders | Medium | Show at least 10 with lower score threshold |
| API load increase | Low | Both endpoints have caching |

## Open Questions

1. Should "Rising Stars" section load by default or on-demand when tab is clicked?
2. What threshold for scientific score to show a trader as "Rising Star"?
