/**
 * Supervisor DLQ Operations Tool
 *
 * Examples:
 *   REDIS_URL=redis://127.0.0.1:6379 \
 *   npx tsx scripts/verify/supervisor-dlq-ops.ts --action stats
 *
 *   REDIS_URL=redis://127.0.0.1:6379 \
 *   npx tsx scripts/verify/supervisor-dlq-ops.ts --action peek --limit 20
 *
 *   REDIS_URL=redis://127.0.0.1:6379 \
 *   npx tsx scripts/verify/supervisor-dlq-ops.ts --action replay --limit 50 --reason EXECUTION_ERROR
 *
 *   REDIS_URL=redis://127.0.0.1:6379 \
 *   npx tsx scripts/verify/supervisor-dlq-ops.ts --action purge --limit 100
 */

import 'dotenv/config';

import Redis from 'ioredis';
import { randomUUID } from 'crypto';

type Action = 'stats' | 'peek' | 'replay' | 'purge';

type DlqEntry = {
    token?: string;
    reason?: string;
    source?: 'nack' | 'reclaim' | string;
    attempt?: number;
    failedAt?: number;
    payload?: string;
};

type CliOptions = {
    action: Action;
    limit: number;
    reason?: string;
    source?: string;
    token?: string;
    dryRun: boolean;
    resetAttempts: boolean;
};

const REDIS_URL = process.env.SUPERVISOR_REDIS_URL || process.env.REDIS_URL || '';
const QUEUE_PREFIX = process.env.SUPERVISOR_QUEUE_PREFIX || 'copytrading:supervisor:';
const QUEUE_KEY = `${QUEUE_PREFIX}queue`;
const PROCESSING_KEY = `${QUEUE_KEY}:processing`;
const INFLIGHT_KEY = `${QUEUE_KEY}:inflight`;
const DLQ_KEY = `${QUEUE_KEY}:dlq`;
const QUEUE_MAX_SIZE = Math.max(1, parseInt(process.env.SUPERVISOR_QUEUE_MAX_SIZE || '5000', 10));

function usage(): never {
    console.error(
        [
            'Usage:',
            '  npx tsx scripts/verify/supervisor-dlq-ops.ts --action <stats|peek|replay|purge> [options]',
            '',
            'Options:',
            '  --limit <n>           Number of entries to process (default: 20)',
            '  --reason <reason>     Filter replay by DLQ reason',
            '  --source <source>     Filter replay by DLQ source (nack|reclaim)',
            '  --token <token>       Filter replay by DLQ token',
            '  --dry-run             Show effect without modifying Redis',
            '  --keep-attempt        Keep payload queueAttempt when replaying (default resets to 0)',
        ].join('\n')
    );
    process.exit(1);
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    let action: Action | null = null;
    let limit = 20;
    let reason: string | undefined;
    let source: string | undefined;
    let token: string | undefined;
    let dryRun = false;
    let resetAttempts = true;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--action') {
            const value = args[++i];
            if (!value) usage();
            if (value !== 'stats' && value !== 'peek' && value !== 'replay' && value !== 'purge') usage();
            action = value;
            continue;
        }
        if (arg === '--limit') {
            const value = Number(args[++i]);
            if (!Number.isFinite(value) || value <= 0) usage();
            limit = Math.floor(value);
            continue;
        }
        if (arg === '--reason') {
            const value = args[++i];
            if (!value) usage();
            reason = value.trim();
            continue;
        }
        if (arg === '--source') {
            const value = args[++i];
            if (!value) usage();
            source = value.trim();
            continue;
        }
        if (arg === '--token') {
            const value = args[++i];
            if (!value) usage();
            token = value.trim();
            continue;
        }
        if (arg === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (arg === '--keep-attempt') {
            resetAttempts = false;
            continue;
        }
        usage();
    }

    if (!action) usage();
    return { action, limit, reason, source, token, dryRun, resetAttempts };
}

function parseDlqEntry(raw: string): DlqEntry | null {
    try {
        const entry = JSON.parse(raw) as DlqEntry;
        if (!entry || typeof entry !== 'object') return null;
        return entry;
    } catch {
        return null;
    }
}

function shouldReplayEntry(entry: DlqEntry, opts: CliOptions): boolean {
    if (opts.reason && String(entry.reason || '') !== opts.reason) return false;
    if (opts.source && String(entry.source || '') !== opts.source) return false;
    if (opts.token && String(entry.token || '') !== opts.token) return false;
    return true;
}

async function getQueueStats(redis: Redis): Promise<{
    pending: number;
    processing: number;
    inFlight: number;
    dlq: number;
}> {
    const [pending, processing, inFlight, dlq] = await Promise.all([
        redis.llen(QUEUE_KEY),
        redis.llen(PROCESSING_KEY),
        redis.hlen(INFLIGHT_KEY),
        redis.llen(DLQ_KEY),
    ]);
    return {
        pending: Number(pending || 0),
        processing: Number(processing || 0),
        inFlight: Number(inFlight || 0),
        dlq: Number(dlq || 0),
    };
}

async function runStats(redis: Redis): Promise<void> {
    const stats = await getQueueStats(redis);
    console.log('[DLQ Ops] Queue Stats');
    console.log(`  pending:    ${stats.pending}`);
    console.log(`  processing: ${stats.processing}`);
    console.log(`  inFlight:   ${stats.inFlight}`);
    console.log(`  dlq:        ${stats.dlq}`);
    console.log(`  active:     ${stats.pending + stats.inFlight}`);
    console.log(`  maxSize:    ${QUEUE_MAX_SIZE}`);
}

async function runPeek(redis: Redis, opts: CliOptions): Promise<void> {
    const total = Number(await redis.llen(DLQ_KEY));
    if (total === 0) {
        console.log('[DLQ Ops] DLQ is empty.');
        return;
    }

    const start = Math.max(0, total - opts.limit);
    const rows = await redis.lrange(DLQ_KEY, start, -1);
    console.log(`[DLQ Ops] DLQ peek last ${rows.length} / total ${total}`);
    rows.forEach((raw, index) => {
        const entry = parseDlqEntry(raw);
        if (!entry) {
            console.log(`  [${index}] invalid entry`);
            return;
        }
        const failedAt = entry.failedAt ? new Date(entry.failedAt).toISOString() : 'n/a';
        console.log(
            `  [${index}] token=${entry.token || 'n/a'} reason=${entry.reason || 'n/a'} source=${entry.source || 'n/a'} attempt=${entry.attempt || 0} failedAt=${failedAt}`
        );
    });
}

function normalizeReplayPayload(payloadRaw: string, resetAttempts: boolean): string | null {
    try {
        const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
        if (!payload || typeof payload !== 'object') return null;
        payload.queueId = randomUUID();
        if (resetAttempts) payload.queueAttempt = 0;
        if (!Number.isFinite(Number(payload.enqueuedAt))) {
            payload.enqueuedAt = Date.now();
        } else {
            payload.enqueuedAt = Date.now();
        }
        return JSON.stringify(payload);
    } catch {
        return null;
    }
}

async function runReplay(redis: Redis, opts: CliOptions): Promise<void> {
    const rows = await redis.lrange(DLQ_KEY, 0, Math.max(0, opts.limit - 1));
    if (rows.length === 0) {
        console.log('[DLQ Ops] No DLQ entries to replay.');
        return;
    }

    let matched = 0;
    let replayed = 0;
    let skipped = 0;
    let invalid = 0;
    let capacityBlocked = 0;

    for (const rawEntry of rows) {
        const entry = parseDlqEntry(rawEntry);
        if (!entry || !entry.payload || typeof entry.payload !== 'string') {
            invalid += 1;
            continue;
        }
        if (!shouldReplayEntry(entry, opts)) {
            skipped += 1;
            continue;
        }
        matched += 1;

        const stats = await getQueueStats(redis);
        if (stats.pending + stats.inFlight >= QUEUE_MAX_SIZE) {
            capacityBlocked += 1;
            continue;
        }

        const normalizedPayload = normalizeReplayPayload(entry.payload, opts.resetAttempts);
        if (!normalizedPayload) {
            invalid += 1;
            continue;
        }

        if (opts.dryRun) {
            replayed += 1;
            continue;
        }

        await redis
            .multi()
            .rpush(QUEUE_KEY, normalizedPayload)
            .lrem(DLQ_KEY, 1, rawEntry)
            .exec();
        replayed += 1;
    }

    console.log('[DLQ Ops] Replay summary');
    console.log(`  scanned:         ${rows.length}`);
    console.log(`  matched:         ${matched}`);
    console.log(`  replayed:        ${replayed}${opts.dryRun ? ' (dry-run)' : ''}`);
    console.log(`  skipped-filter:  ${skipped}`);
    console.log(`  invalid:         ${invalid}`);
    console.log(`  capacity-block:  ${capacityBlocked}`);
}

async function runPurge(redis: Redis, opts: CliOptions): Promise<void> {
    const size = Number(await redis.llen(DLQ_KEY));
    if (size <= 0) {
        console.log('[DLQ Ops] DLQ already empty.');
        return;
    }
    const removeCount = Math.min(size, opts.limit);
    if (opts.dryRun) {
        console.log(`[DLQ Ops] Purge dry-run: would remove ${removeCount} / ${size} DLQ entries.`);
        return;
    }

    if (removeCount >= size) {
        await redis.del(DLQ_KEY);
    } else {
        await redis.ltrim(DLQ_KEY, removeCount, -1);
    }
    console.log(`[DLQ Ops] Purged ${removeCount} DLQ entries (remaining ${Math.max(0, size - removeCount)}).`);
}

async function main(): Promise<void> {
    const opts = parseArgs();
    if (!REDIS_URL) {
        console.error('Missing SUPERVISOR_REDIS_URL or REDIS_URL.');
        process.exit(1);
    }

    const redis = new Redis(REDIS_URL, { enableReadyCheck: true, maxRetriesPerRequest: 2 });
    try {
        await redis.ping();
        console.log(`[DLQ Ops] action=${opts.action} prefix=${QUEUE_PREFIX} dryRun=${opts.dryRun}`);

        if (opts.action === 'stats') {
            await runStats(redis);
            return;
        }
        if (opts.action === 'peek') {
            await runPeek(redis, opts);
            return;
        }
        if (opts.action === 'replay') {
            await runReplay(redis, opts);
            return;
        }
        if (opts.action === 'purge') {
            await runPurge(redis, opts);
            return;
        }
    } finally {
        await redis.quit().catch(() => null);
    }
}

main().catch((error) => {
    console.error('[DLQ Ops] Failed:', error);
    process.exit(1);
});
