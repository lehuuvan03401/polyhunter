
/**
 * Copy Trading Real-time Worker
 * 
 * This script runs as a persistent process to monitor blockchain/websocket events
 * and execute copy trades with minimal latency.
 * 
 * Usage: npx tsx scripts/copy-trading-worker.ts
 */

import { RealTimeDataClient, UnifiedCache } from '@catalyst-team/poly-sdk';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

// Initialize clients
const prisma = new PrismaClient();
const cache = new UnifiedCache('copy-worker');
const realtime = new RealTimeDataClient(cache);

// Configuration
const REFRESH_INTERVAL_MS = 60_000; // Refresh active configs every minute
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface WatchedConfig {
    id: string;
    traderAddress: string;
    // ... minimal fields needed for quick filtering
}

// State
let activeConfigs: Map<string, WatchedConfig[]> = new Map(); // address -> configs[]
let watchedAddresses: Set<string> = new Set();

async function refreshConfigs() {
    try {
        console.log('Refreshing active copy trading configs...');
        const configs = await prisma.copyTradingConfig.findMany({
            where: { isActive: true },
            select: {
                id: true,
                traderAddress: true,
                mode: true,
                sideFilter: true,
            }
        });

        // Group by trader address
        const newMap = new Map<string, WatchedConfig[]>();
        const newSet = new Set<string>();

        for (const config of configs) {
            const addr = config.traderAddress.toLowerCase();
            if (!newMap.has(addr)) {
                newMap.set(addr, []);
                newSet.add(addr);
            }
            newMap.get(addr)?.push(config as any);
        }

        activeConfigs = newMap;
        watchedAddresses = newSet;

        console.log(`Updated: Monitoring ${configs.length} configs for ${newSet.size} traders.`);
    } catch (error) {
        console.error('Failed to refresh configs:', error);
    }
}

async function handleTrade(trade: any) {
    try {
        const traderAddr = trade.trader?.address?.toLowerCase();
        if (!traderAddr || !watchedAddresses.has(traderAddr)) return;

        const configs = activeConfigs.get(traderAddr);
        if (!configs) return;

        console.log(`🎯 Trade detected from ${traderAddr}: ${trade.side} ${trade.size} @ ${trade.price}`);

        // For each matching config, trigger execution logic via API
        // We use the API endpoint to reuse the complex filtering and logic in `detect` + `execute`
        // But for speed, we could move logic here.
        // For Phase 2, let's call a specific "instant-execute" internal endpoint or reuse `detect` logic.

        // Since `detect` is poll-based, we simulate a "detection" event.
        // Or better, we directly call the execute endpoint if we can create the PENDING record quickly.

        // Strategy:
        // 1. We detected it here < 100ms.
        // 2. We should ideally create a PENDING record directly in DB.
        // 3. Then call execute with executeOnServer=true.

        // For simplicity in this script, let's just log it for now as proof of concept for the "Real-time" phase.
        // Next step would be to insert into prisma.copyTrade and call execute API.

        console.log(`   -> Should trigger execution for ${configs.length} followers.`);

    } catch (error) {
        console.error('Error handling trade:', error);
    }
}

async function start() {
    console.log('🚀 Starting Copy Trading Worker...');

    // Initial config load
    await refreshConfigs();
    setInterval(refreshConfigs, REFRESH_INTERVAL_MS);

    // Subscribe to all market activity (or specific heavy markets if "all" is too much)
    // The SDK example allows subscribing to activity.
    // Note: Polymarket websocket might require specific market slugs or allow "all".
    // For now, let's assume we need to subscribe to active markets found in configs or a global feed if available.

    // In the Absence of a global "all markets" activity feed from client usage:
    // We might need to subscribe to the top 50 markets or similar.
    // Let's try to subscribe to a known active market for testing.

    console.log('Connecting to WebSocket...');

    // Since we don't have a "global" firehose in the strict SDK typings sometimes,
    // we assume we can pass an wildcard or empty filter if supported.
    // If not, we'd iterate active markets.

    // For the purpose of this task (Phase 2), we'll implement the structure.
    // RealtimeServiceV2 usage:
    /*
    realtime.subscribeActivity({ market: "all" }, (trade) => {
       handleTrade(trade);
    });
    */

    console.log('Worker is running. Press Ctrl+C to exit.');
}

start();
