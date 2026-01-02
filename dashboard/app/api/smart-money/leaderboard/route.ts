import { NextRequest, NextResponse } from 'next/server';
import { getReadOnlySDK } from '@/lib/sdk';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '50');
        const period = searchParams.get('period') || '7d';

        const sdk = getReadOnlySDK();

        // Get smart money list from SDK
        const smartWallets = await sdk.smartMoney.getSmartMoneyList(limit);

        return NextResponse.json({
            success: true,
            data: smartWallets,
            metadata: {
                count: smartWallets.length,
                period,
                timestamp: Date.now(),
            }
        });

    } catch (error) {
        console.error('Error fetching smart money leaderboard:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch leaderboard'
            },
            { status: 500 }
        );
    }
}
