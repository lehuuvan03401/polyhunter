import { NextRequest, NextResponse } from 'next/server';
import {
    discoverSmartMoneyTraders,
    type DiscoveredSmartMoneyTrader,
} from '@/lib/services/smart-money-discovery-service';

const CACHE_TTL = 5 * 60 * 1000;

let cachedTraders: DiscoveredSmartMoneyTrader[] = [];
let lastFetchTime = 0;
let inFlight: Promise<DiscoveredSmartMoneyTrader[]> | null = null;

async function fetchTopTraders(limit: number): Promise<DiscoveredSmartMoneyTrader[]> {
    if (inFlight) {
        const shared = await inFlight;
        return shared.slice(0, limit);
    }

    inFlight = discoverSmartMoneyTraders(Math.max(limit, 50));
    try {
        const traders = await inFlight;
        cachedTraders = traders;
        lastFetchTime = Date.now();
        return traders.slice(0, limit);
    } finally {
        inFlight = null;
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const now = Date.now();
        if (!forceRefresh && cachedTraders.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
            return NextResponse.json({
                traders: cachedTraders.slice(0, limit),
                cached: true,
                source: 'memory',
                cachedAt: new Date(lastFetchTime).toISOString(),
                ttlRemaining: Math.round((CACHE_TTL - (now - lastFetchTime)) / 1000),
                algorithm: 'smart-money-discovery-v2',
            }, {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            });
        }

        const traders = await fetchTopTraders(limit);
        const fetchTime = lastFetchTime || Date.now();

        return NextResponse.json({
            traders,
            cached: false,
            source: 'live',
            cachedAt: new Date(fetchTime).toISOString(),
            ttlRemaining: Math.round(CACHE_TTL / 1000),
            algorithm: 'smart-money-discovery-v2',
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error('[TopTraders] Error:', error);

        if (cachedTraders.length > 0) {
            return NextResponse.json({
                traders: cachedTraders.slice(0, limit),
                cached: true,
                stale: true,
                source: 'memory-fallback',
                error: 'Failed to refresh, returning stale data',
            });
        }

        return NextResponse.json(
            { error: 'Failed to fetch top traders', traders: [] },
            { status: 500 }
        );
    }
}
