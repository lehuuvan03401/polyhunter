import { NextRequest, NextResponse } from 'next/server';
import { createUserProxy, getUserProxy, TIER_FEES } from '../utils';

// Define tier type locally to avoid Prisma 7 import issues
type TierType = 'STARTER' | 'PRO' | 'WHALE';

/**
 * POST /api/proxy/create
 * Create a new proxy for a user
 * 
 * Body: { walletAddress: string, proxyAddress: string, tier?: 'STARTER' | 'PRO' | 'WHALE' }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, proxyAddress, tier = 'STARTER' } = body;

        if (!walletAddress || !proxyAddress) {
            return NextResponse.json(
                { error: 'walletAddress and proxyAddress are required' },
                { status: 400 }
            );
        }

        // Validate tier
        if (!['STARTER', 'PRO', 'WHALE'].includes(tier)) {
            return NextResponse.json(
                { error: 'Invalid tier. Must be STARTER, PRO, or WHALE' },
                { status: 400 }
            );
        }

        // Check if user already has a proxy
        const existingProxy = await getUserProxy(walletAddress);
        if (existingProxy) {
            return NextResponse.json(
                { error: 'User already has a proxy', proxy: existingProxy },
                { status: 409 }
            );
        }

        // Create proxy record
        const proxy = await createUserProxy(
            walletAddress,
            proxyAddress,
            tier as TierType
        );

        return NextResponse.json({
            success: true,
            proxy,
            feePercent: TIER_FEES[tier as TierType] / 100,
        });
    } catch (error) {
        console.error('Error creating proxy:', error);
        return NextResponse.json(
            { error: 'Failed to create proxy' },
            { status: 500 }
        );
    }
}

