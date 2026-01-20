# Design: Trader Leaderboard Caching System

## Context
The current implementation of the "Top 10 Traders by Copy Score" feature on the homepage makes multiple Polymarket API calls for each user visit. This includes:
- Fetching leaderboard candidates (`getLeaderboard`)
- Fetching positions for each trader (`getPositions`)
- Fetching activity history for each trader (`getActivity`)
- Computing complex scientific scores in real-time

This architecture leads to:
- Slow page load times (several seconds)
- High load on Polymarket's rate-limited APIs
- Poor scalability as user traffic increases
- Redundant computation of the same data across multiple requests

## Goals
- **Primary**: Reduce homepage load time from several seconds to sub-second
- **Secondary**: Reduce external API call volume by 95%+
- **Tertiary**: Enable horizontal scaling without hitting API rate limits

## Non-Goals
- Real-time trader updates (some staleness is acceptable)
- Sub-second cache refresh intervals (would defeat the purpose)
- Caching individual trader profiles (focus is leaderboard only)

## Decisions

### Decision 1: Database-Backed Cache vs In-Memory Cache
**Choice**: Database-backed cache (Prisma + PostgreSQL)

**Rationale**:
- Survives application restarts
- Shared across multiple frontend instances (horizontal scaling)
- Provides persistent audit trail of cache updates
- Integrates naturally with existing Prisma setup

**Alternatives Considered**:
- **Redis/In-Memory**: Would be faster but adds new infrastructure dependency. Overkill for updates every 5-10 minutes.
- **Static File Cache**: Simpler but lacks transaction safety and metadata tracking.

### Decision 2: Pull-Based Cron vs Push-Based WebSocket
**Choice**: Pull-based scheduled updates (cron/systemd timer)

**Rationale**:
- Simpler to implement and debug
- Predictable resource usage (runs at known intervals)
- Easier to operate (standard cron patterns)
- Cache freshness requirements are relaxed (5-10 min acceptable)

**Alternatives Considered**:
- **WebSocket Event Listener**: Would enable real-time updates but adds complexity (connection management, deduplication). Unnecessary given user requirements.

### Decision 3: Cache Granularity
**Choice**: Cache at the **period level** (7d, 15d, 30d, 90d)

**Rationale**:
- Frontend currently defaults to 7d on homepage
- Different periods may have different top traders
- Allows future expansion to period selector UI

**Schema**:
```prisma
model CachedTraderLeaderboard {
  id              String   @id @default(cuid())
  period          String   // "7d", "15d", "30d", "90d"
  rank            Int
  traderData      Json     // Full ActiveTrader object
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([period, rank])
  @@index([period])
}

model LeaderboardCacheMeta {
  id              String   @id @default(cuid())
  period          String   @unique
  lastUpdateAt    DateTime
  status          String   // "SUCCESS", "FAILED", "IN_PROGRESS"
  traderCount     Int?
  errorMessage    String?
  updatedAt       DateTime @updatedAt
}
```

### Decision 4: Cache Expiry Strategy
**Choice**: TTL-based with graceful fallback

**Behavior**:
- Cache considered "fresh" if `lastUpdateAt` within configured TTL (default: 10 minutes)
- If cache expired: Log warning + return cached data anyway + trigger async refresh
- If cache empty: Fallback to live fetch (slow but functional)

**Rationale**:
- Prioritizes availability over perfect freshness
- Avoids thundering herd on cache expiry
- Graceful degradation if background job fails

## Risks / Trade-offs

### Risk: Stale Data Display
- **Impact**: Users see leaderboard that's up to 10 minutes old
- **Mitigation**: Display "Updated X minutes ago" timestamp on UI
- **Acceptance**: User explicitly requested caching; staleness is acceptable

### Risk: Background Job Failure
- **Impact**: Cache not updated, data gets increasingly stale
- **Mitigation**: 
  - Fallback to live data if cache older than 1 hour
  - Monitor `LeaderboardCacheMeta.status` for failures
  - Alert on consecutive failures

### Risk: Database Storage Growth
- **Impact**: Caching multiple periods with full trader objects (JSON) may grow large
- **Mitigation**: 
  - Store only top 20 traders per period (not entire leaderboard)
  - Add retention policy: Delete cache entries older than 7 days
  - Current estimate: ~20 traders × 4 periods × ~5KB/trader = ~400KB (negligible)

## Migration Plan

### Phase 1: Add Schema (No Breaking Changes)
1. Add Prisma models for caching
2. Run migration to create tables
3. Deploy schema changes (tables exist but unused)

### Phase 2: Implement Cache Service
1. Create `leaderboard-cache-service.ts` with update/fetch logic
2. Create background script `update-leaderboard-cache.ts`
3. Test manually: Verify cache population and reads

### Phase 3: Update API Route
1. Modify `/api/traders/active` to check cache first
2. Keep live fetch as fallback
3. Add feature flag `USE_LEADERBOARD_CACHE` (default: true)
4. Deploy with feature flag off initially

### Phase 4: Enable Caching
1. Schedule cron job for cache updates
2. Monitor first 24 hours for errors
3. Enable feature flag (`USE_LEADERBOARD_CACHE=true`)
4. Measure page load time improvement

### Rollback Plan
- Set `USE_LEADERBOARD_CACHE=false` to revert to live fetching
- No data loss risk (cache is additive, not replacing source of truth)

## Open Questions
1. **Cache Update Frequency**: 5 minutes vs 10 minutes? (User to confirm)
2. **Which Periods to Cache**: All (7d, 15d, 30d, 90d) or just 7d for MVP? (User to confirm)
3. **Deployment Environment**: Where will cron job run? (Cloud Functions, systemd on VM, Kubernetes CronJob?)
