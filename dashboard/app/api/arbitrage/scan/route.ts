import { NextRequest, NextResponse } from 'next/server';
import { ArbitrageService } from '@catalyst-team/poly-sdk';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const minVolume = parseInt(searchParams.get('minVolume') || '1000');
        const profitThreshold = parseFloat(searchParams.get('profitThreshold') || '0.01');

        // Create arbitrage service for scanning
        const arbitrageService = new ArbitrageService({
            enableLogging: false,
        });

        // Scan for arbitrage opportunities using correct property name
        const opportunities = await arbitrageService.scanMarkets({
            minVolume24h: minVolume,
        }, profitThreshold);

        return NextResponse.json({
            success: true,
            data: opportunities,
            metadata: {
                count: opportunities.length,
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
