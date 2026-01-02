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

        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '50');

        // Use SDK's built-in dataApi for trades
        const sdk = getReadOnlySDK();
        const trades = await sdk.dataApi.getTrades({ user: address, limit });

        return NextResponse.json({
            success: true,
            data: trades,
            metadata: {
                count: trades.length,
                address,
                timestamp: Date.now(),
            }
        });

    } catch (error) {
        console.error('Error fetching trades:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch trades'
            },
            { status: 500 }
        );
    }
}
