import { NextRequest, NextResponse } from 'next/server';
import { getUserProxy, updateProxyStats, TIER_FEE_PERCENTAGES } from '../utils';

/**
 * GET /api/proxy/status?wallet=0x...
 * Get user's proxy status and stats
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'wallet query parameter is required' },
                { status: 400 }
            );
        }

        const proxy = await getUserProxy(walletAddress);

        if (!proxy) {
            return NextResponse.json({
                hasProxy: false,
                proxy: null,
            });
        }

        return NextResponse.json({
            hasProxy: true,
            proxy: {
                ...proxy,
                feePercent: TIER_FEE_PERCENTAGES[proxy.tier],
                netProfit: proxy.totalProfit - proxy.totalFeesPaid,
            },
        });
    } catch (error) {
        console.error('Error fetching proxy status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch proxy status' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/proxy/status
 * Update proxy stats (called by backend sync job)
 * 
 * Body: { proxyAddress: string, stats: { ... } }
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { proxyAddress, stats } = body;

        if (!proxyAddress || !stats) {
            return NextResponse.json(
                { error: 'proxyAddress and stats are required' },
                { status: 400 }
            );
        }

        const updated = await updateProxyStats(proxyAddress, stats);

        return NextResponse.json({
            success: true,
            proxy: updated,
        });
    } catch (error) {
        console.error('Error updating proxy stats:', error);
        return NextResponse.json(
            { error: 'Failed to update proxy stats' },
            { status: 500 }
        );
    }
}
