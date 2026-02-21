# Tasks: Cache Top Traders Leaderboard Data

## 1. Database Schema
- [ ] Add `CachedTraderLeaderboard` model to `prisma/schema.prisma`
- [ ] Add `LeaderboardCacheMeta` model for tracking update status
- [ ] Run migration to create tables

## 2. Cache Service Implementation
- [ ] Create `lib/services/leaderboard-cache-service.ts`
- [ ] Implement `updateLeaderboardCache()` - Fetch and store trader data
- [ ] Implement `getLeaderboardFromCache()` - Read cached data with TTL check
- [ ] Implement `getCacheMetadata()` - Get last update timestamp and status

## 3. Background Update Script
- [ ] Create `scripts/update-leaderboard-cache.ts`
- [ ] Import and use cache service to update data
- [ ] Add error handling and logging
- [ ] Add command-line options (period, limit, force refresh)
- [ ] Test manually: `npx tsx scripts/update-leaderboard-cache.ts`

## 4. API Route Update
- [ ] Modify `/api/traders/active/route.ts` to read from cache
- [ ] Add fallback to live data if cache is empty or expired
- [ ] Add cache metadata to response (cached: true, timestamp, etc.)
- [ ] Keep existing query parameters for compatibility

## 5. Deployment Configuration
- [ ] Document cron job setup in `README.md` or deployment docs
- [ ] Create example crontab entry or systemd timer
- [ ] Add environment variable for cache TTL configuration
- [ ] Test deployment script in staging environment

## 6. Verification
- [ ] Verify cache updates successfully via script
- [ ] Verify API returns cached data with correct metadata
- [ ] Verify page load times improved (before/after comparison)
- [ ] Verify cache expiry and refresh behavior
- [ ] Load test: Confirm multiple concurrent users don't trigger API calls
