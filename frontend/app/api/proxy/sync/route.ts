import { NextRequest, NextResponse } from 'next/server';
import { syncAllProxyStats, getPlatformProfitStats } from '../profit-service';
import { prisma } from '@/lib/prisma';

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

        // Create sync log entry
        const syncLog = await prisma.syncLog.create({
            data: {
                type: 'PROXY_STATS',
            },
        });

        const result = await syncAllProxyStats();

        const duration = Date.now() - startTime;
        console.log(`[Sync] Completed in ${duration}ms. Synced: ${result.synced}, Failed: ${result.failed}`);

        // Update sync log with results
        await prisma.syncLog.update({
            where: { id: syncLog.id },
            data: {
                completedAt: new Date(),
                synced: result.synced,
                failed: result.failed,
                durationMs: duration,
                errors: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 20)) : null,
            },
        });

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
export async function GET() {
    try {
        const stats = await getPlatformProfitStats();

        // Get last successful sync
        const lastSync = await prisma.syncLog.findFirst({
            where: {
                type: 'PROXY_STATS',
                completedAt: { not: null },
            },
            orderBy: { startedAt: 'desc' },
            select: {
                startedAt: true,
                completedAt: true,
                synced: true,
                failed: true,
                durationMs: true,
            },
        });

        return NextResponse.json({
            platformStats: stats,
            lastSync: lastSync ? {
                startedAt: lastSync.startedAt,
                completedAt: lastSync.completedAt,
                synced: lastSync.synced,
                failed: lastSync.failed,
                durationMs: lastSync.durationMs,
            } : null,
        });
    } catch (error) {
        console.error('[Sync] Error fetching stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
