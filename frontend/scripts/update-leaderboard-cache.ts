#!/usr/bin/env tsx
import 'dotenv/config';
/**
 * Update Leaderboard Cache Script
 * 
 * Background job to update cached trader leaderboard data.
 * Can be run manually or scheduled via cron/systemd timer.
 * 
 * Usage:
 *   npm run cache:update
 *   npm run cache:update -- --period 7d --limit 20
 *   npm run cache:update -- --force
 */

import {
    updateLeaderboardCache,
    Period,
    updateSmartMoneyCache
} from '../lib/services/leaderboard-cache-service';

/**
 * Update Leaderboard Cache Script
 * 
 * Manual run:
 * npx tsx scripts/update-leaderboard-cache.ts --period 7d
 * 
 * Update all:
 * npx tsx scripts/update-leaderboard-cache.ts --all
 * 
 * Update only Smart Money:
 * npx tsx scripts/update-leaderboard-cache.ts --smart-money
 */
async function main() {
    console.log('[UpdateCache] Starting leaderboard cache update...');
    const startTime = Date.now();

    // Parse CLI arguments
    const args = process.argv.slice(2);

    const isAll = args.includes('--all');
    const isSmartMoneyOnly = args.includes('--smart-money');

    const periodIdx = args.indexOf('--period');
    const period = periodIdx !== -1 ? args[periodIdx + 1] as Period : '7d';

    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 100;

    const forceIdx = args.indexOf('--force');
    const force = forceIdx !== -1;

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: npm run cache:update -- [options]

Options:
  --period <7d|15d|30d|90d>  Time period to cache (default: 7d)
  --limit <number>           Number of top traders to cache (default: 20)
  --force                    Force refresh even if recently updated
  --all                      Update all leaderboard periods and smart money
  --smart-money              Update only smart money leaderboard
  --help, -h                 Show this help message

Examples:
  npm run cache:update
  npm run cache:update -- --period 30d --limit 10
  npm run cache:update -- --force
  npm run cache:update -- --all
  npm run cache:update -- --smart-money
        `);
        process.exit(0);
    }

    console.log('[UpdateCache] Starting cache update process...');

    try {
        if (isAll) {
            console.log('[UpdateCache] Updating all leaderboard periods...');
            const periods: Period[] = ['7d', '15d', '30d', '90d'];
            for (const p of periods) {
                console.log(`[UpdateCache] Updating leaderboard for period: ${p}`);
                await updateLeaderboardCache(p, limit);
            }
            console.log('[UpdateCache] Starting Smart Money update...');
            await updateSmartMoneyCache(100);
        } else if (isSmartMoneyOnly) {
            console.log('[UpdateCache] Updating Smart Money only...');
            await updateSmartMoneyCache(limit > 20 ? limit : 100);
        } else {
            console.log(`[UpdateCache] Updating period: ${period}, Limit: ${limit}, Force: ${force}`);
            await updateLeaderboardCache(period, limit);
        }

        const duration = Date.now() - startTime;
        console.log(`✓ [UpdateCache] Completed successfully in ${duration}ms`);
        process.exit(0);
    } catch (error) {
        console.error('✗ [UpdateCache] Failed:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('[UpdateCache] Fatal error:', error);
    process.exit(1);
});
