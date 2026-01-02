import { NextRequest, NextResponse } from 'next/server';
import { getReadOnlySDK } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ address: string }> }
) {
    try {
        const { address } = await context.params;

        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return NextResponse.json(
                { success: false, error: 'Invalid wallet address' },
                { status: 400 }
            );
        }

        const sdk = getReadOnlySDK();

        // Get wallet profile
        const profile = await sdk.wallets.getWalletProfile(address);

        // Check if smart money
        const isSmartMoney = await sdk.smartMoney.isSmartMoney(address);

        return NextResponse.json({
            success: true,
            data: {
                ...profile,
                isSmartMoney,
            }
        });

    } catch (error) {
        console.error('Error fetching wallet data:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch wallet data'
            },
            { status: 500 }
        );
    }
}
