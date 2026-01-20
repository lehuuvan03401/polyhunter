import { NextRequest, NextResponse } from 'next/server';
import { polyClient } from '@/lib/polymarket';
import {
    getSmartMoneyFromCache,
    getSmartMoneyCacheMetadata,
    isCacheFresh,
    updateSmartMoneyCache
} from '@/lib/services/leaderboard-cache-service';

// In-memory cache for ultra-fast repeated hits
const memoryCache: Record<string, { data: any[], fetchedAt: number }> = {};
const MEMORY_TTL = 60 * 1000; // 1 minute

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = `${page}-${limit}`;
    const now = Date.now();

    // 1. Layer: In-Memory Cache
    if (!forceRefresh && memoryCache[cacheKey] && (now - memoryCache[cacheKey].fetchedAt) < MEMORY_TTL) {
        return NextResponse.json({
            source: 'memory',
            cached: true,
            traders: memoryCache[cacheKey].data,
        });
    }

    try {
        // 2. Layer: Database Cache
        const meta = await getSmartMoneyCacheMetadata();
        const useCache = !forceRefresh && process.env.USE_LEADERBOARD_CACHE !== 'false';

        if (useCache && meta && meta.status === 'SUCCESS') {
            const cachedTraders = await getSmartMoneyFromCache(page, limit);

            if (cachedTraders && cachedTraders.length > 0) {
                const fresh = isCacheFresh(meta.lastUpdateAt, 10);

                // Update memory cache
                memoryCache[cacheKey] = { data: cachedTraders, fetchedAt: now };

                return NextResponse.json({
                    source: 'database',
                    cached: true,
                    fresh,
                    lastUpdateAt: meta.lastUpdateAt,
                    traders: cachedTraders,
                });
            }
        }

        // 3. Layer: Live Fallback (Slow)
        console.log(`[SmartMoneyAPI] Cache miss or stale for page ${page}. Fetching live...`);
        const liveTraders = await polyClient.smartMoney.getSmartMoneyList({ page, limit });

        if (!liveTraders || liveTraders.length === 0) {
            return NextResponse.json({ traders: [], source: 'live' });
        }

        // Update memory cache
        memoryCache[cacheKey] = { data: liveTraders, fetchedAt: now };

        // If cache was totally empty, trigger an async background update for the whole thing
        if (!meta) {
            updateSmartMoneyCache(100).catch(err => {
                console.error('[SmartMoneyAPI] Async cache update failed:', err);
            });
        }

        return NextResponse.json({
            source: 'live',
            cached: false,
            traders: liveTraders,
        });

    } catch (error) {
        console.error('[SmartMoneyAPI] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch smart money data' },
            { status: 500 }
        );
    }
}
