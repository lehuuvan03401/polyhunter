import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeAddress, errorResponse } from '../../affiliate/utils';

// Log a new transaction
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, proxyAddress, type, amount, txHash, status } = body;

        if (!walletAddress || !type || amount === undefined) {
            return errorResponse('Missing required fields');
        }

        const normalized = normalizeAddress(walletAddress);

        // Find or Create user proxy (in case it exists on-chain but not in DB)
        let userProxy = await prisma.userProxy.findUnique({
            where: { walletAddress: normalized },
        });

        if (!userProxy) {
            if (proxyAddress) {
                // Auto-register if we have the proxy address
                const normalizedProxy = normalizeAddress(proxyAddress);
                try {
                    userProxy = await prisma.userProxy.create({
                        data: {
                            walletAddress: normalized,
                            proxyAddress: normalizedProxy,
                            tier: 'STARTER', // Default
                        }
                    });
                } catch (createErr) {
                    console.error('Failed to auto-create proxy record:', createErr);
                    return errorResponse('Failed to register proxy record', 500);
                }
            } else {
                return errorResponse('User proxy not found in DB and no proxyAddress provided', 400);
            }
        }

        // Create transaction record
        const transaction = await prisma.proxyTransaction.create({
            data: {
                userProxyId: userProxy.id,
                type,
                amount: Number(amount),
                txHash: txHash || null,
                status: status || 'COMPLETED',
            },
        });

        // Update totals in UserProxy
        if (status === 'COMPLETED') {
            if (type === 'DEPOSIT') {
                await prisma.userProxy.update({
                    where: { id: userProxy.id },
                    data: { totalDeposited: { increment: Number(amount) } }
                });
            } else if (type === 'WITHDRAW') {
                await prisma.userProxy.update({
                    where: { id: userProxy.id },
                    data: { totalWithdrawn: { increment: Number(amount) } }
                });
            }
        }

        return NextResponse.json({ success: true, data: transaction });

    } catch (error) {
        console.error('Log transaction error:', error);
        return errorResponse('Internal server error', 500);
    }
}

// Get transaction history
export async function GET(request: NextRequest) {
    try {
        const walletAddress = request.nextUrl.searchParams.get('walletAddress');

        if (!walletAddress) {
            return errorResponse('Wallet address is required');
        }

        const normalized = normalizeAddress(walletAddress);

        const userProxy = await prisma.userProxy.findUnique({
            where: { walletAddress: normalized },
        });

        if (!userProxy) {
            return NextResponse.json({ success: true, data: [] }); // No proxy means no history
        }

        const transactions = await prisma.proxyTransaction.findMany({
            where: { userProxyId: userProxy.id },
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit to recent 50
        });

        return NextResponse.json({ success: true, data: transactions });

    } catch (error) {
        console.error('Fetch transactions error:', error);
        return errorResponse('Internal server error', 500);
    }
}
