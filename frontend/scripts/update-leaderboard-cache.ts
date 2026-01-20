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

import { updateLeaderboardCache } from '../lib/services/leaderboard-cache-service';

type Period = '7d' | '15d' | '30d' | '90d';

async function main() {
    console.log('[UpdateCache] Starting leaderboard cache update...');
    const startTime = Date.now();

    // Parse CLI arguments
    const args = process.argv.slice(2);
    let period: Period = '7d';
    let limit = 20;
    let force = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--period' && args[i + 1]) {
            const p = args[i + 1];
            if (['7d', '15d', '30d', '90d'].includes(p)) {
                period = p as Period;
            } else {
                console.error(`Invalid period: ${p}. Must be one of: 7d, 15d, 30d, 90d`);
                process.exit(1);
            }
            i++;
        } else if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[i + 1], 10);
            if (isNaN(limit) || limit < 1) {
                console.error(`Invalid limit: ${args[i + 1]}. Must be a positive number.`);
                process.exit(1);
            }
            i++;
        } else if (args[i] === '--force') {
            force = true;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Usage: npm run cache:update -- [options]

Options:
  --period <7d|15d|30d|90d>  Time period to cache (default: 7d)
  --limit <number>           Number of top traders to cache (default: 20)
  --force                    Force refresh even if recently updated
  --help, -h                 Show this help message

Examples:
  npm run cache:update
  npm run cache:update -- --period 30d --limit 10
  npm run cache:update -- --force
            `);
            process.exit(0);
        }
    }

    console.log(`[UpdateCache] Period: ${period}, Limit: ${limit}, Force: ${force}`);

    try {
        const result = await updateLeaderboardCache(period, limit);

        const duration = Date.now() - startTime;

        if (result.success) {
            console.log(`✓ [UpdateCache] Successfully cached ${result.traderCount} traders for ${period}`);
            console.log(`✓ [UpdateCache] Completed in ${duration}ms`);
            process.exit(0);
        } else {
            console.error(`✗ [UpdateCache] Failed to update cache: ${result.error}`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`✗ [UpdateCache] Unexpected error:`, error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('[UpdateCache] Fatal error:', error);
    process.exit(1);
});
