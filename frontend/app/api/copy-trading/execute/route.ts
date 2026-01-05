/**
 * Copy Trading Execute API
 * 
 * Confirm and execute a pending copy trade
 * This is called by the frontend when user confirms a trade
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/copy-trading/execute
 * Mark a pending copy trade as executed (after frontend execution)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tradeId, walletAddress, txHash, status, errorMessage } = body;

        if (!tradeId || !walletAddress) {
            return NextResponse.json(
                { error: 'Missing tradeId or walletAddress' },
                { status: 400 }
            );
        }

        // Find the trade and verify ownership
        const trade = await prisma.copyTrade.findFirst({
            where: {
                id: tradeId,
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                },
            },
            include: {
                config: true,
            },
        });

        if (!trade) {
            return NextResponse.json(
                { error: 'Trade not found or unauthorized' },
                { status: 404 }
            );
        }

        if (trade.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Trade is not in pending status' },
                { status: 400 }
            );
        }

        // Update trade status
        const executionStatus = status === 'executed' ? 'EXECUTED' :
            status === 'failed' ? 'FAILED' :
                status === 'skipped' ? 'SKIPPED' : 'FAILED';

        const updatedTrade = await prisma.copyTrade.update({
            where: { id: tradeId },
            data: {
                status: executionStatus,
                txHash: txHash || null,
                errorMessage: errorMessage || null,
                executedAt: executionStatus === 'EXECUTED' ? new Date() : null,
            },
        });

        return NextResponse.json({ trade: updatedTrade });
    } catch (error) {
        console.error('Error executing copy trade:', error);
        return NextResponse.json(
            { error: 'Failed to execute trade' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/copy-trading/execute
 * Get pending trades that need user confirmation
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        // Get pending trades that haven't expired
        const pendingTrades = await prisma.copyTrade.findMany({
            where: {
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                    isActive: true,
                },
                status: 'PENDING',
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                config: {
                    select: {
                        traderName: true,
                        traderAddress: true,
                    },
                },
            },
            orderBy: { detectedAt: 'desc' },
        });

        // Expire old pending trades
        await prisma.copyTrade.updateMany({
            where: {
                status: 'PENDING',
                expiresAt: {
                    lt: new Date(),
                },
            },
            data: {
                status: 'EXPIRED',
            },
        });

        return NextResponse.json({ pendingTrades });
    } catch (error) {
        console.error('Error fetching pending trades:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending trades' },
            { status: 500 }
        );
    }
}
