# Proposal: Cache Top Traders Leaderboard Data

## Goal
Improve page load performance for the homepage (`http://localhost:3000/`) by eliminating direct Polymarket API calls for the "Top 10 Traders by Copy Score" section. Move data fetching to a server-side background process with database caching.

## Problem
Currently, when users first visit the homepage, the frontend fetches trader data through `/api/traders/active`, which:
1. Makes multiple Polymarket API calls (`getLeaderboard`, `getPositions`, `getActivity`) for each trader
2. Processes complex scoring calculations in real-time
3. Results in slow initial page load times (several seconds of "Loading...")
4. Creates unnecessary load on Polymarket's APIs

## Solution

### Backend Caching System
- **Component**: New background service + database schema
- **Change**: 
  - Create a `CachedTraderLeaderboard` table in Prisma schema to store pre-computed trader rankings
  - Implement a background worker script that:
    - Fetches and scores traders using existing logic from `/api/traders/active`
    - Stores results in the database with timestamp
    - Runs on a configurable schedule (e.g., every 5-10 minutes)
  - Update `/api/traders/active` to read from cache instead of computing live

### Operational Script
- **Component**: Cron job / scheduled task
- **Change**:
  - Create a standalone script (`scripts/update-leaderboard-cache.ts`) that can be:
    - Run manually for testing
    - Scheduled via cron/systemd timer for production
    - Deployed as a cloud scheduler job (Cloud Functions, AWS Lambda, etc.)

## Benefits
- **Faster Page Loads**: Homepage loads instantly with cached data
- **Reduced API Load**: Polymarket APIs called once per update interval instead of per user visit
- **Scalability**: Can handle many concurrent users without API rate limits
- **Cost Efficiency**: Fewer external API calls

## Impact
- **Affected Specs**: Creates new `trader-leaderboard` capability
- **Affected Code**:
  - `frontend/prisma/schema.prisma` - New table
  - `frontend/app/api/traders/active/route.ts` - Read from cache
  - `frontend/scripts/update-leaderboard-cache.ts` - New background job
  - `frontend/lib/services/leaderboard-cache-service.ts` - Cache management logic

## Trade-offs
- **Data Freshness**: Leaderboard data will be X minutes stale (configurable)
- **Infrastructure**: Requires scheduled job deployment
- **Storage**: Additional database storage for cached rankings
