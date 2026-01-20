
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const history = await prisma.copyTrade.findMany({
            where: {
                config: {
                    walletAddress: walletAddress.toLowerCase()
                },
                status: 'EXECUTED'
            },
            orderBy: {
                detectedAt: 'desc'
            },
            take: 100
        });

        // Map to standard format matching getWalletActivity
        const formattedHistory = history.map(trade => ({
            transactionHash: trade.txHash || `sim-${trade.id}`,
            timestamp: Math.floor(new Date(trade.detectedAt).getTime() / 1000),
            side: trade.originalSide, // 'BUY' or 'SELL'
            outcome: trade.outcome,
            title: trade.marketSlug,
            size: trade.copySize,
            price: trade.copyPrice || trade.originalPrice,
            simulated: true
        }));

        return NextResponse.json(formattedHistory);
    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
