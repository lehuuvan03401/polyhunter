// DOTENV_CONFIG_PATH=frontend/.env.local \
// SUPERVISOR_QUEUE_STRESS_COUNT=5200 \
// npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/queue-backpressure.ts


import 'dotenv/config';

import Redis from 'ioredis';
import { prisma, isDatabaseEnabled } from '../../lib/prisma';

const REDIS_URL = process.env.SUPERVISOR_REDIS_URL || process.env.REDIS_URL || '';
const QUEUE_MAX_SIZE = parseInt(process.env.SUPERVISOR_QUEUE_MAX_SIZE || '5000', 10);
const QUEUE_STRESS_COUNT = parseInt(process.env.SUPERVISOR_QUEUE_STRESS_COUNT || String(QUEUE_MAX_SIZE + 100), 10);
const TOKEN_ID = process.env.SUPERVISOR_QUEUE_STRESS_TOKEN_ID || 'mock-queue-stress-token';
const SIDE = (process.env.SUPERVISOR_QUEUE_STRESS_SIDE || 'BUY').toUpperCase() as 'BUY' | 'SELL';
const PRICE = Number(process.env.SUPERVISOR_QUEUE_STRESS_PRICE || '0.5');
const SIZE = Number(process.env.SUPERVISOR_QUEUE_STRESS_SIZE || '10');
const DEFAULT_TRADER = process.env.SUPERVISOR_QUEUE_STRESS_TRADER || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const DEFAULT_WALLET = process.env.SUPERVISOR_QUEUE_STRESS_WALLET || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CLEANUP_QUEUE = process.env.SUPERVISOR_QUEUE_STRESS_CLEANUP !== 'false';

const QUEUE_KEY = 'copytrading:supervisor:queue';

async function main() {
    if (!REDIS_URL) {
        console.error('Missing SUPERVISOR_REDIS_URL/REDIS_URL. Aborting.');
        process.exit(1);
    }

    if (!isDatabaseEnabled) {
        console.error('DATABASE_URL not set or invalid. Aborting.');
        process.exit(1);
    }

    const redis = new Redis(REDIS_URL, { enableReadyCheck: true, maxRetriesPerRequest: 2 });

    try {
        await redis.ping();
        await redis.del(QUEUE_KEY);
        let createdConfigId: string | null = null;
        let config = await prisma.copyTradingConfig.findFirst({
            where: { isActive: true, autoExecute: true, channel: 'EVENT_LISTENER' },
        });

        if (!config) {
            config = await prisma.copyTradingConfig.create({
                data: {
                    walletAddress: DEFAULT_WALLET,
                    traderAddress: DEFAULT_TRADER,
                    traderName: 'queue-stress',
                    maxSlippage: 1.0,
                    slippageType: 'FIXED',
                    autoExecute: true,
                    channel: 'EVENT_LISTENER',
                    mode: 'FIXED_AMOUNT',
                    fixedAmount: 10,
                    isActive: true,
                },
            });
            createdConfigId = config.id;
        }

        const payload = {
            config: {
                id: config.id,
                walletAddress: config.walletAddress,
                traderAddress: config.traderAddress,
                tradeSizeMode: config.tradeSizeMode,
                mode: config.mode,
                fixedAmount: config.fixedAmount || undefined,
                sizeScale: config.sizeScale || undefined,
                maxSizePerTrade: config.maxSizePerTrade,
                minSizePerTrade: config.minSizePerTrade || undefined,
                maxSlippage: config.maxSlippage,
                slippageType: config.slippageType,
                autoExecute: config.autoExecute,
                executionMode: config.executionMode,
                encryptedKey: config.encryptedKey || undefined,
                iv: config.iv || undefined,
                apiKey: config.apiKey || undefined,
                apiSecret: config.apiSecret || undefined,
                apiPassphrase: config.apiPassphrase || undefined,
                minLiquidity: config.minLiquidity || undefined,
                minVolume: config.minVolume || undefined,
                maxOdds: config.maxOdds || undefined,
            },
            side: SIDE,
            tokenId: TOKEN_ID,
            approxPrice: PRICE,
            originalTrader: config.traderAddress,
            originalSize: SIZE,
            isPreflight: false,
            overrides: undefined,
            enqueuedAt: Date.now(),
        };

        let enqueued = 0;
        let dropped = 0;

        for (let i = 0; i < QUEUE_STRESS_COUNT; i++) {
            const size = await redis.llen(QUEUE_KEY);
            if (size >= QUEUE_MAX_SIZE) {
                dropped += 1;
                continue;
            }
            await redis.rpush(QUEUE_KEY, JSON.stringify(payload));
            enqueued += 1;
        }

        const finalDepth = await redis.llen(QUEUE_KEY);

        console.log('[QueueStress] Result');
        console.log(`  Attempted: ${QUEUE_STRESS_COUNT}`);
        console.log(`  Enqueued:  ${enqueued}`);
        console.log(`  Dropped:   ${dropped}`);
        console.log(`  Depth:     ${finalDepth}`);
        console.log(`  MaxSize:   ${QUEUE_MAX_SIZE}`);
        if (CLEANUP_QUEUE) {
            await redis.del(QUEUE_KEY);
            console.log('  Cleanup:   queue cleared');
        }
        if (createdConfigId) {
            await prisma.copyTradingConfig.delete({ where: { id: createdConfigId } }).catch(() => null);
        }
    } finally {
        await prisma.$disconnect().catch(() => null);
        await redis.quit().catch(() => null);
    }
}

main().catch((err) => {
    console.error('Queue stress test failed:', err);
    process.exit(1);
});
