import { NextRequest, NextResponse } from 'next/server';
import {
    getSmartMoneyFromCache,
    getSmartMoneyCacheMetadata,
    isCacheFresh,
    updateSmartMoneyCache
} from '@/lib/services/leaderboard-cache-service';
import { isDatabaseEnabled } from '@/lib/prisma';
import {
    discoverSmartMoneyTraders,
    type DiscoveredSmartMoneyTrader,
} from '@/lib/services/smart-money-discovery-service';

// In-memory cache for ultra-fast repeated hits
const memoryCache: Record<string, { data: DiscoveredSmartMoneyTrader[]; fetchedAt: number }> = {};
const MEMORY_TTL = 60 * 1000; // 1 minute
const inFlightRequests: Record<string, Promise<SmartMoneyResponse> | undefined> = {};
let lastBackgroundUpdateAt = 0;
const BG_UPDATE_COOLDOWN = 2 * 60 * 1000;

type SmartMoneyResponse = {
    traders: DiscoveredSmartMoneyTrader[];
    cached?: boolean;
    source?: 'memory' | 'database' | 'database-fallback' | 'live';
    fresh?: boolean;
    lastUpdateAt?: Date;
    error?: string;
};

function scheduleBackgroundUpdate(limit: number) {
    const now = Date.now();
    if (now - lastBackgroundUpdateAt < BG_UPDATE_COOLDOWN) {
        return;
    }
    lastBackgroundUpdateAt = now;
    updateSmartMoneyCache(limit).catch((err) => {
        console.error('[SmartMoneyAPI] BG Update failed:', err);
    });
}

async function buildResponsePayload(
    page: number,
    limit: number,
    forceRefresh: boolean
): Promise<SmartMoneyResponse> {
    const cacheKey = `${page}-${limit}`;
    const now = Date.now();

    // 1. Layer: In-Memory Cache
    if (!forceRefresh && memoryCache[cacheKey] && (now - memoryCache[cacheKey].fetchedAt) < MEMORY_TTL) {
        return {
            source: 'memory',
            cached: true,
            traders: memoryCache[cacheKey].data,
        };
    }

    // 2. Layer: Database Cache (Preferred)
    const useCache = !forceRefresh && process.env.USE_LEADERBOARD_CACHE !== 'false' && isDatabaseEnabled;
    const meta = useCache ? await getSmartMoneyCacheMetadata() : null;
    if (useCache && meta && meta.status === 'SUCCESS') {
        const cachedTraders = (await getSmartMoneyFromCache(page, limit)) as DiscoveredSmartMoneyTrader[] | null;
        if (cachedTraders && cachedTraders.length > 0) {
            const fresh = isCacheFresh(meta.lastUpdateAt, 10);
            if (!fresh) {
                scheduleBackgroundUpdate(Math.max(100, page * limit));
            }
            memoryCache[cacheKey] = { data: cachedTraders, fetchedAt: now };
            return {
                source: 'database',
                cached: true,
                fresh,
                lastUpdateAt: meta.lastUpdateAt,
                traders: cachedTraders,
            };
        }
    }

    // 3. Layer: Live Fallback
    console.log(`[SmartMoneyAPI] Cache miss for page ${page}. Fetching live...`);
    let liveTraders: DiscoveredSmartMoneyTrader[] = [];

    try {
        const targetCount = Math.max(page * limit, 100);
        const discovered = await discoverSmartMoneyTraders(targetCount);
        liveTraders = discovered.slice((page - 1) * limit, page * limit);
    } catch (fetchError) {
        console.warn(`[SmartMoneyAPI] Live fetch failed for page ${page}:`, fetchError);
        // If live fetch fails, try DB cache one last time even if metadata says it might be stale/partial
        if (isDatabaseEnabled) {
            const fallbackTraders = (await getSmartMoneyFromCache(page, limit)) as DiscoveredSmartMoneyTrader[] | null;
            if (fallbackTraders && fallbackTraders.length > 0) {
                return {
                    source: 'database-fallback',
                    cached: true,
                    traders: fallbackTraders,
                };
            }
        }
        // If completely failed, return empty list instead of 500 to keep UI alive
        return {
            traders: [],
            error: "Unable to load live data and cache is empty."
        };
    }

    if (!liveTraders || liveTraders.length === 0) {
        return { traders: [], source: 'live' };
    }

    memoryCache[cacheKey] = { data: liveTraders, fetchedAt: now };

    // Trigger background update when DB cache is missing or stale
    if (useCache && (!meta || !isCacheFresh(meta.lastUpdateAt, 10))) {
        scheduleBackgroundUpdate(Math.max(100, page * limit));
    }

    return {
        source: 'live',
        cached: false,
        traders: liveTraders,
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const cacheKey = `${page}-${limit}`;
        if (!forceRefresh && inFlightRequests[cacheKey]) {
            const sharedPayload = await inFlightRequests[cacheKey];
            return NextResponse.json(sharedPayload);
        }

        const requestPromise = buildResponsePayload(page, limit, forceRefresh);
        inFlightRequests[cacheKey] = requestPromise;

        try {
            const payload = await requestPromise;
            return NextResponse.json(payload);
        } finally {
            delete inFlightRequests[cacheKey];
        }

    } catch (error) {
        console.error('[SmartMoneyAPI] Critical Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch smart money data', traders: [] }, // Return empty list + error so UI handles it gracefully
            { status: 200 } // Soft fail
        );
    }
}
