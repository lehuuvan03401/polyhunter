import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const IDEMPOTENCY_BUCKET_MS = parseInt(process.env.COPY_TRADING_IDEMPOTENCY_BUCKET_MS || '5000', 10);
const GLOBAL_DAILY_CAP_USD = Number(process.env.COPY_TRADING_DAILY_CAP_USD || '0');
const WALLET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_WALLET_DAILY_CAP_USD || '0');

function normalizeNumber(value: number, decimals: number = 6): string {
    if (!Number.isFinite(value)) return '0';
    return Number(value).toFixed(decimals);
}

function buildIdempotencyKey(input: {
    configId: string;
    transactionHash?: string | null;
    tokenId?: string | null;
    side: string;
    size: number;
    price: number;
    timestampMs: number;
}): string {
    const txHash = input.transactionHash?.toLowerCase();
    if (txHash) {
        return createHash('sha256')
            .update(`tx:${input.configId}:${txHash}`)
            .digest('hex');
    }

    const bucket = Math.floor(input.timestampMs / IDEMPOTENCY_BUCKET_MS);
    const raw = [
        'fallback',
        input.configId,
        input.tokenId || 'unknown',
        input.side,
        normalizeNumber(input.size, 6),
        normalizeNumber(input.price, 6),
        String(bucket),
    ].join('|');

    return createHash('sha256').update(raw).digest('hex');
}

async function getExecutedTotalSince(since: Date, walletAddress?: string): Promise<number> {
    const where = {
        status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
        executedAt: { gte: since },
        ...(walletAddress
            ? { config: { walletAddress: walletAddress.toLowerCase() } }
            : {}),
    } as any;

    const result = await prisma.copyTrade.aggregate({
        _sum: { copySize: true },
        where,
    });

    return Number(result?._sum?.copySize || 0);
}

async function main() {
    const configId = process.env.VERIFY_CONFIG_ID || '';
    const walletAddress = process.env.VERIFY_WALLET_ADDRESS || '';
    const tokenId = process.env.VERIFY_TOKEN_ID || '';
    const side = process.env.VERIFY_SIDE || 'BUY';
    const size = Number(process.env.VERIFY_ORIGINAL_SIZE || '0');
    const price = Number(process.env.VERIFY_ORIGINAL_PRICE || '0');
    const timestampMs = Number(process.env.VERIFY_TRADE_TIMESTAMP_MS || Date.now());
    const transactionHash = process.env.VERIFY_TX_HASH || null;
    const amountUsd = Number(process.env.VERIFY_AMOUNT_USD || '0');

    if (!configId) {
        console.warn('VERIFY_CONFIG_ID is required to compute idempotency key.');
    } else {
        const key = buildIdempotencyKey({
            configId,
            transactionHash,
            tokenId,
            side,
            size,
            price,
            timestampMs,
        });
        console.log(`Idempotency Key: ${key}`);

        const existing = await prisma.copyTrade.findUnique({
            where: { idempotencyKey: key },
            select: { id: true, status: true },
        });

        if (existing) {
            console.log(`Existing CopyTrade: ${existing.id} (${existing.status})`);
        } else {
            console.log('No existing CopyTrade found for this idempotency key.');
        }
    }

    if (amountUsd > 0) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const globalUsed = await getExecutedTotalSince(since);
        console.log(`Global used (24h): ${globalUsed.toFixed(2)} / ${GLOBAL_DAILY_CAP_USD || '∞'}`);

        if (walletAddress) {
            const walletUsed = await getExecutedTotalSince(since, walletAddress);
            console.log(`Wallet used (24h): ${walletUsed.toFixed(2)} / ${WALLET_DAILY_CAP_USD || '∞'}`);
        }
    }
}

main()
    .catch((error) => {
        console.error('Verification failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
