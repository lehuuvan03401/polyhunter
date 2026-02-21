import { NextResponse } from 'next/server';
import { getPlatformStats, getTierBreakdown } from '../utils';

/**
 * GET /api/proxy/stats
 * Get platform-wide proxy statistics (admin endpoint)
 */
export async function GET() {
    try {
        const [platformStats, tierBreakdown] = await Promise.all([
            getPlatformStats(),
            getTierBreakdown(),
        ]);

        return NextResponse.json({
            platform: platformStats,
            tiers: tierBreakdown,
        });
    } catch (error) {
        console.error('Error fetching platform stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch platform stats' },
            { status: 500 }
        );
    }
}
