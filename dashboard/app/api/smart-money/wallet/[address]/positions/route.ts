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

        // Use SDK's built-in dataApi for positions
        const sdk = getReadOnlySDK();
        const positions = await sdk.dataApi.getPositions(address);

        return NextResponse.json({
            success: true,
            data: positions,
            metadata: {
                count: positions.length,
                address,
                timestamp: Date.now(),
            }
        });

    } catch (error) {
        console.error('Error fetching positions:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch positions'
            },
            { status: 500 }
        );
    }
}
