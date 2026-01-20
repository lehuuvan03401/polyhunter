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
        // 2. Layer: Database Cache (Preferred)
        const meta = await getSmartMoneyCacheMetadata();
        const useCache = !forceRefresh && process.env.USE_LEADERBOARD_CACHE !== 'false';

        // Check DB first if allowed
        if (useCache && meta && meta.status === 'SUCCESS') {
            const cachedTraders = await getSmartMoneyFromCache(page, limit);
            if (cachedTraders && cachedTraders.length > 0) {
                const fresh = isCacheFresh(meta.lastUpdateAt, 10);
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

        // 3. Layer: Live Fallback
        console.log(`[SmartMoneyAPI] Cache miss for page ${page}. Fetching live...`);
        let liveTraders: any[] = [];

        try {
            liveTraders = await polyClient.smartMoney.getSmartMoneyList({ page, limit });
        } catch (fetchError) {
            console.warn(`[SmartMoneyAPI] Live fetch failed for page ${page}:`, fetchError);
            // If live fetch fails, try DB cache one last time even if metadata says it might be stale/partial
            const fallbackTraders = await getSmartMoneyFromCache(page, limit);
            if (fallbackTraders && fallbackTraders.length > 0) {
                return NextResponse.json({
                    source: 'database-fallback',
                    cached: true,
                    traders: fallbackTraders
                });
            }
            // If completely failed, return empty list instead of 500 to keep UI alive
            return NextResponse.json({
                traders: [],
                error: "Unable to load live data and cache is empty."
            });
        }

        if (!liveTraders || liveTraders.length === 0) {
            return NextResponse.json({ traders: [], source: 'live' });
        }

        memoryCache[cacheKey] = { data: liveTraders, fetchedAt: now };

        // Trigger background update if cache is empty/missing
        if (!meta) {
            updateSmartMoneyCache(100).catch(err => console.error('[SmartMoneyAPI] BG Update failed:', err));
        }

        return NextResponse.json({
            source: 'live',
            cached: false,
            traders: liveTraders,
        });

    } catch (error) {
        console.error('[SmartMoneyAPI] Critical Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch smart money data', traders: [] }, // Return empty list + error so UI handles it gracefully
            { status: 200 } // Soft fail
        );
    }
}
