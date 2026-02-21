import { NextRequest, NextResponse } from 'next/server';
import {
    discoverSmartMoneyTraders,
    type DiscoveredSmartMoneyTrader,
} from '@/lib/services/smart-money-discovery-service';

const CACHE_TTL = 5 * 60 * 1000;

type TopReasonCode =
    | 'high_score'
    | 'low_drawdown'
    | 'high_profit_factor'
    | 'copy_friendly'
    | 'high_activity'
    | 'strong_recent_pnl';

type TopTraderItem = DiscoveredSmartMoneyTrader & {
    reasonCodes: TopReasonCode[];
    reasonSummary: string;
};

let cachedTraders: TopTraderItem[] = [];
let lastFetchTime = 0;
let inFlight: Promise<TopTraderItem[]> | null = null;

function getReasonCodes(trader: DiscoveredSmartMoneyTrader): TopReasonCode[] {
    const reasons: TopReasonCode[] = [];

    if (trader.score >= 90) reasons.push('high_score');
    if (trader.maxDrawdown <= 12) reasons.push('low_drawdown');
    if (trader.profitFactor >= 2) reasons.push('high_profit_factor');
    if (trader.copyFriendliness >= 70) reasons.push('copy_friendly');
    if (trader.recentTrades >= 80) reasons.push('high_activity');
    if (trader.pnl >= 100_000) reasons.push('strong_recent_pnl');

    if (reasons.length === 0) {
        reasons.push('high_score');
    }

    return reasons.slice(0, 3);
}

function buildReasonSummary(codes: TopReasonCode[]): string {
    const parts: string[] = [];
    if (codes.includes('high_score')) parts.push('high score');
    if (codes.includes('low_drawdown')) parts.push('low drawdown');
    if (codes.includes('high_profit_factor')) parts.push('strong profit factor');
    if (codes.includes('copy_friendly')) parts.push('copy-friendly execution');
    if (codes.includes('high_activity')) parts.push('high recent activity');
    if (codes.includes('strong_recent_pnl')) parts.push('strong recent pnl');
    return parts.slice(0, 2).join(', ');
}

async function fetchTopTraders(limit: number): Promise<TopTraderItem[]> {
    if (inFlight) {
        const shared = await inFlight;
        return shared.slice(0, limit);
    }

    inFlight = discoverSmartMoneyTraders(Math.max(limit, 50)).then((traders) =>
        traders.map((trader) => {
            const reasonCodes = getReasonCodes(trader);
            return {
                ...trader,
                reasonCodes,
                reasonSummary: buildReasonSummary(reasonCodes),
            };
        })
    );
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
