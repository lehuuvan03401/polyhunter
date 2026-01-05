import { NextRequest, NextResponse } from 'next/server';
import { syncAllProxyStats, getPlatformProfitStats } from '../profit-service';

// Simple API key authentication for cron jobs
const API_SECRET = process.env.SYNC_API_SECRET || 'dev-secret';

/**
 * POST /api/proxy/sync
 * Syncs all proxy stats from on-chain to database
 * 
 * This endpoint should be called periodically by a cron job
 * to keep database stats in sync with on-chain data.
 * 
 * Headers: { Authorization: Bearer <API_SECRET> }
 */
export async function POST(request: NextRequest) {
    try {
        // Verify API secret
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('[Sync] Starting proxy stats sync...');
        const startTime = Date.now();

        const result = await syncAllProxyStats();

        const duration = Date.now() - startTime;
        console.log(`[Sync] Completed in ${duration}ms. Synced: ${result.synced}, Failed: ${result.failed}`);

        return NextResponse.json({
            success: true,
            synced: result.synced,
            failed: result.failed,
            errors: result.errors.slice(0, 10), // Limit errors in response
            durationMs: duration,
        });
    } catch (error) {
        console.error('[Sync] Error:', error);
        return NextResponse.json(
            { error: 'Sync failed', message: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/proxy/sync
 * Get sync status and platform stats
 */
export async function GET(request: NextRequest) {
    try {
        const stats = await getPlatformProfitStats();

        return NextResponse.json({
            platformStats: stats,
            lastSyncAvailable: false, // TODO: Track last sync time
        });
    } catch (error) {
        console.error('[Sync] Error fetching stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
