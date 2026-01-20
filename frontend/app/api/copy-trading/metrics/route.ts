
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { polyClient } from '@/lib/polymarket';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Standardize to lowercase for consistent DB matching
    const normalizedWallet = walletAddress.toLowerCase();

    try {
        // 1. Get Open Positions (for Invested Funds & Unrealized PnL)
        const positions = await prisma.userPosition.findMany({
            where: {
                walletAddress: normalizedWallet,
                balance: { gt: 0 }
            }
        });

        // Calculate Invested Funds (Total Cost Basis of open positions)
        const totalInvested = positions.reduce((sum, pos) => sum + pos.totalCost, 0);

        // 2. Fetch Current Prices for Unrealized PnL
        let unrealizedPnL = 0;

        if (positions.length > 0) {
            try {
                // Get unique token IDs
                const tokenIds = positions.map(p => p.tokenId);

                // Fetch orderbooks to get current mid/best price
                // Using same logic as positions route
                const orderbooks = await polyClient.markets.getTokenOrderbooks(
                    tokenIds.map(id => ({ tokenId: id, side: 'BUY' }))
                );

                // Calculate PnL per position
                positions.forEach(pos => {
                    const book = orderbooks.get(pos.tokenId);
                    // Use best bid as liquidation value (conservative)
                    // Or mid price if preferred. Let's use best bid to match 'Sell All' value.
                    let currentPrice = 0;
                    if (book && book.bids.length > 0) {
                        currentPrice = Number(book.bids[0].price);
                    } else {
                        // If no liquidity, use 0 or last known? 
                        // fallback to 0 for conservative PnL
                        currentPrice = 0;
                    }

                    // Value diff = (Current price * Balance) - Total Cost
                    const positionValue = currentPrice * pos.balance;
                    const profit = positionValue - pos.totalCost;
                    unrealizedPnL += profit;
                });
            } catch (err) {
                console.warn('Failed to calculate unrealized PnL:', err);
                // Fallback: don't add to PnL if fetch failed
            }
        }

        // 3. Get Realized PnL
        // For now, consistent with simulation limitation, we leave Realized as 0 
        // until we add a ledger or PnL field to CopyTrade.
        // Most dashboard movement comes from Unrealized PnL anyway.
        const realizedPnL = 0;

        return NextResponse.json({
            totalInvested,
            activePositions: positions.length,
            realizedPnL,
            unrealizedPnL,
            totalPnl: realizedPnL + unrealizedPnL // Frontend likely uses this
        });

    } catch (error) {
        console.error('Error fetching metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
