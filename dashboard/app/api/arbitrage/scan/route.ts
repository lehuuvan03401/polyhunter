import { NextRequest, NextResponse } from 'next/server';
import { ArbitrageService } from '@catalyst-team/poly-sdk';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const minVolume = parseInt(searchParams.get('minVolume') || '1000');
        const profitThreshold = parseFloat(searchParams.get('profitThreshold') || '0.01');
        const maxResults = parseInt(searchParams.get('maxResults') || '20');

        // Use SDK's ArbitrageService for verified arbitrage scanning
        const arbitrageService = new ArbitrageService({
            enableLogging: false,
        });

        // Scan for arbitrage opportunities using SDK's verified implementation
        const opportunities = await arbitrageService.scanMarkets({
            minVolume24h: minVolume,
        }, profitThreshold);

        // Limit results
        const limitedOpportunities = opportunities.slice(0, maxResults);

        return NextResponse.json({
            success: true,
            data: limitedOpportunities,
            metadata: {
                count: limitedOpportunities.length,
                totalFound: opportunities.length,
                minVolume,
                profitThreshold,
                timestamp: Date.now(),
            }
        });

    } catch (error) {
        console.error('Error scanning for arbitrage:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to scan markets'
            },
            { status: 500 }
        );
    }
}
