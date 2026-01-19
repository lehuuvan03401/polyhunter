/**
 * Copy Trading Strategies API
 * 
 * GET /api/copy-trading/strategies
 * Fetch active copy trading strategies for a wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');
        const status = searchParams.get('status') || 'active'; // default to active

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        // Determine isActive filter based on status
        const isActive = status === 'active';

        // Fetch strategies based on status
        const strategies = await prisma.copyTradingConfig.findMany({
            where: {
                walletAddress: walletAddress.toLowerCase(),
                isActive: isActive,
            },
            select: {
                id: true,
                traderName: true,
                traderAddress: true,
                mode: true,
                fixedAmount: true,
                sizeScale: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ strategies });
    } catch (error) {
        console.error('[Strategies API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to fetch strategies', details: errorMessage },
            { status: 500 }
        );
    }
}
