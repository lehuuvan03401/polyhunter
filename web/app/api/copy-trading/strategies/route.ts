/**
 * Copy Trading Strategies API
 * 
 * GET /api/copy-trading/strategies
 * Fetch active copy trading strategies for a wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'active'; // default to active
        const walletCheck = resolveCopyTradingWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
        });
        if (!walletCheck.ok) {
            return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
        }
        const walletAddress = walletCheck.wallet;

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
                executionMode: true,
                autoExecute: true,
                slippageType: true,
                maxSlippage: true,
                infiniteMode: true,
                direction: true,
                maxSizePerTrade: true,
                updatedAt: true,
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
