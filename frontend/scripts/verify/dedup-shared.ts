import 'dotenv/config';

import Redis from 'ioredis';

const REDIS_URL = process.env.SUPERVISOR_REDIS_URL || process.env.REDIS_URL || '';
const TTL_MS = parseInt(
    process.env.SUPERVISOR_DEDUP_TEST_TTL_MS
        || process.env.SUPERVISOR_DEDUP_TTL_MS
        || '60000',
    10
);
const WAIT_MS = parseInt(process.env.SUPERVISOR_DEDUP_TEST_WAIT_MS || '0', 10);
const TX_HASH = (process.env.SUPERVISOR_DEDUP_TEST_TX || '0xdeadbeef').toLowerCase();
const LOG_INDEX = process.env.SUPERVISOR_DEDUP_TEST_LOG_INDEX
    ? Number(process.env.SUPERVISOR_DEDUP_TEST_LOG_INDEX)
    : 1;

const PREFIX = 'copytrading:supervisor:dedup:';

function buildKey(txHash: string, logIndex?: number): string {
    if (logIndex !== undefined && logIndex !== null) {
        return `${txHash}:${logIndex}`;
    }
    return txHash;
}

async function main() {
    if (!REDIS_URL) {
        console.error('Missing SUPERVISOR_REDIS_URL/REDIS_URL. Aborting.');
        process.exit(1);
    }

    const redis = new Redis(REDIS_URL, { enableReadyCheck: true, maxRetriesPerRequest: 2 });

    try {
        await redis.ping();
        const key = buildKey(TX_HASH, Number.isFinite(LOG_INDEX) ? LOG_INDEX : undefined);
        const fullKey = `${PREFIX}${key}`;

        const first = await redis.set(fullKey, '1', 'PX', TTL_MS, 'NX');
        const second = await redis.set(fullKey, '1', 'PX', TTL_MS, 'NX');

        console.log('[DedupTest] Result');
        console.log(`  Key:     ${fullKey}`);
        console.log(`  TTL_MS:  ${TTL_MS}`);
        console.log(`  First:   ${first === 'OK' ? 'OK' : 'MISS'}`);
        console.log(`  Second:  ${second === 'OK' ? 'OK' : 'DUPLICATE'}`);

        if (WAIT_MS > 0) {
            await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
            const third = await redis.set(fullKey, '1', 'PX', TTL_MS, 'NX');
            console.log(`  AfterWait(${WAIT_MS}ms): ${third === 'OK' ? 'OK' : 'DUPLICATE'}`);
        }
    } finally {
        await redis.quit().catch(() => null);
    }
}

main().catch((err) => {
    console.error('Dedup test failed:', err);
    process.exit(1);
});
