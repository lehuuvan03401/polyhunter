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
                    // First check if a record already exists with this proxyAddress
                    const existingByProxy = await prisma.userProxy.findUnique({
                        where: { proxyAddress: normalizedProxy },
                    });

                    if (existingByProxy) {
                        // If proxy exists but for different wallet, use existing record
                        // (This handles re-mapping scenarios)
                        userProxy = existingByProxy;
                    } else {
                        // Create new record
                        userProxy = await prisma.userProxy.create({
                            data: {
                                walletAddress: normalized,
                                proxyAddress: normalizedProxy,
                                tier: 'STARTER',
                            }
                        });
                    }
                } catch (createErr: any) {
                    // Handle race condition - record might have been created between checks
                    if (createErr?.code === 'P2002') {
                        userProxy = await prisma.userProxy.findFirst({
                            where: {
                                OR: [
                                    { walletAddress: normalized },
                                    { proxyAddress: normalizeAddress(proxyAddress) }
                                ]
                            }
                        });
                        if (!userProxy) {
                            console.error('Failed to find existing proxy record after P2002:', createErr);
                            return errorResponse('Failed to register proxy record', 500);
                        }
                    } else {
                        console.error('Failed to auto-create proxy record:', createErr);
                        return errorResponse('Failed to register proxy record', 500);
                    }
                }
            } else {
                return errorResponse('User proxy not found in DB and no proxyAddress provided', 400);
            }
        }

        // Check for duplicate txHash to prevent double logging
        if (txHash) {
            const existing = await prisma.proxyTransaction.findFirst({
                where: { txHash: txHash }
            });
            if (existing) {
                console.log('Skipping duplicate transaction:', txHash);
                return NextResponse.json({ success: true, data: existing, duplicate: true });
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
        const proxyAddress = request.nextUrl.searchParams.get('proxyAddress');

        if (!walletAddress && !proxyAddress) {
            return errorResponse('Wallet address or proxy address is required');
        }

        let userProxy = null;

        // Try to find by walletAddress first
        if (walletAddress) {
            const normalized = normalizeAddress(walletAddress);
            userProxy = await prisma.userProxy.findUnique({
                where: { walletAddress: normalized },
            });
        }

        // If not found and proxyAddress provided, try that
        if (!userProxy && proxyAddress) {
            const normalizedProxy = normalizeAddress(proxyAddress);
            userProxy = await prisma.userProxy.findUnique({
                where: { proxyAddress: normalizedProxy },
            });
        }

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

// Delete old transactions, keeping only the latest one
export async function DELETE(request: NextRequest) {
    try {
        const walletAddress = request.nextUrl.searchParams.get('walletAddress');
        const proxyAddress = request.nextUrl.searchParams.get('proxyAddress');
        const keepLatest = request.nextUrl.searchParams.get('keepLatest') === 'true';

        if (!walletAddress && !proxyAddress) {
            return errorResponse('Wallet address or proxy address is required');
        }

        let userProxy = null;

        if (walletAddress) {
            const normalized = normalizeAddress(walletAddress);
            userProxy = await prisma.userProxy.findUnique({
                where: { walletAddress: normalized },
            });
        }

        if (!userProxy && proxyAddress) {
            const normalizedProxy = normalizeAddress(proxyAddress);
            userProxy = await prisma.userProxy.findUnique({
                where: { proxyAddress: normalizedProxy },
            });
        }

        if (!userProxy) {
            return NextResponse.json({ success: true, deleted: 0, message: 'No user proxy found' });
        }

        if (keepLatest) {
            // Get all transactions ordered by date
            const transactions = await prisma.proxyTransaction.findMany({
                where: { userProxyId: userProxy.id },
                orderBy: { createdAt: 'desc' },
            });

            if (transactions.length <= 1) {
                return NextResponse.json({ success: true, deleted: 0, message: 'Nothing to delete' });
            }

            // Delete all except the latest
            const toDelete = transactions.slice(1).map(t => t.id);
            const result = await prisma.proxyTransaction.deleteMany({
                where: { id: { in: toDelete } }
            });

            return NextResponse.json({
                success: true,
                deleted: result.count,
                kept: transactions[0]
            });
        } else {
            // Delete all transactions
            const result = await prisma.proxyTransaction.deleteMany({
                where: { userProxyId: userProxy.id }
            });

            return NextResponse.json({ success: true, deleted: result.count });
        }

    } catch (error) {
        console.error('Delete transactions error:', error);
        return errorResponse('Internal server error', 500);
    }
}
