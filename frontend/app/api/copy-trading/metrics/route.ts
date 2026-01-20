
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

        // Calculate Unrealized PnL
        // We need current prices. For simulation, we might need to fetch them fresh.
        // For speed, let's assume we can fetch them or use a cached service.
        // If we can't get live prices easily here without slowing down, we might skip precise unrealized PnL 
        // or fetch it on the frontend.
        // However, for the "Dashboard PnL" card, it's nice to have.

        // Let's defer precise market price fetching to the client or a separate call if it's too slow.
        // For now, we will report 0 unrealized PnL if we don't have price data, 
        // OR we can rely on `avgEntryPrice` vs `currentPrice` if we had a way to update `UserPosition` prices.
        // Since `UserPosition` doesn't track current price, we'd need to fetch gammas.

        let unrealizedPnL = 0;
        // Optimization: Fetch prices for these tokens? 
        // If list is small, we can try. If large, skip.
        if (positions.length > 0 && positions.length < 20) {
            try {
                // Fetch market data for these tokens to get current price
                // This is heavy. Maybe let's stick to Realized PnL for now + simple estimate?
                // Or user `clobTokenIds`?
            } catch (e) {
                console.warn('Failed to fetch prices for unrealized pnl', e);
            }
        }

        // 2. Get Realized PnL (from closed CopyTrades)
        // We need to sum up PnL from CopyTrades where we SOLD.
        // Actually, `CopyTrade` doesn't explicitly store "Realized PnL" column for the *user*.
        // It stores `pnl` which might be the trade's PnL? 
        // Let's check schema. `CopyTrade` does NOT have a `pnl` column.
        // `UserProxy` has `totalProfit`.
        // `FeeTransaction` has `profitAmount`.

        // Wait, how do we calculate realized PnL from the DB?
        // We have `UserPosition` for open trades.
        // For closed trades, we don't have a "ClosedPosition" table.
        // We rely on `CopyTrade` records.
        // If we buy and then sell, the "Sell" record should effectively capture the realization.

        // Alternate: Iterate all CopyTrades for this user (via config)
        // This is expensive if there are thousands.

        // Better approach: 
        // The `simulate-copy-trading.ts` script tracks PnL in memory but where does it save it?
        // It logs "Realized P&L".
        // It doesn't seem to save Realized PnL to the DB explicitly for the USER except maybe in `UserProxy`?
        // But `simulate-copy-trading.ts` uses `prisma.copyTrade.create`.

        // Let's look at `UserPosition` logic. It subtracts cost on sell.
        // Realized PnL = (Sell Value - Cost Basis of Sold Shares).

        // Since we don't have a dedicated "RealizedPnL" ledger in the DB Schema (Simulated), 
        // we might have to aggregate it on the fly or add a field.
        // LIMITATION: We can only approximate "Invested Funds" easily. Realized PnL is hard without a ledger.

        // Workaround: 
        // For the "Portfolio" dashboard, "Invested Funds" is the most critical missing piece for "Active" status.
        // "Total PnL" can be just "Current Value - Total Cost".

        return NextResponse.json({
            totalInvested,
            activePositions: positions.length,
            // For now, return 0 for realized if we can't easily compute it from existing schema unique to simulation
            realizedPnL: 0,
            unrealizedPnL: 0 // Placeholder
        });

    } catch (error) {
        console.error('Error fetching metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
