const configId = process.env.VERIFY_CONFIG_ID || '';
const enableWrite = process.env.VERIFY_PREWRITE_WRITE === 'true';
const PREFIX = 'verify-prewrite';

function buildKey(suffix: string) {
    return `${PREFIX}-${suffix}-${Date.now()}`;
}

async function main() {
    let PrismaClient: any;
    try {
        ({ PrismaClient } = await import('@prisma/client'));
    } catch (error) {
        console.error('Missing @prisma/client. Install dependencies or run from a context where Prisma is available.');
        process.exit(1);
    }

    const prisma = new PrismaClient();

    if (!configId && enableWrite) {
        console.error('VERIFY_CONFIG_ID is required for write verification. Provide a valid CopyTradingConfig id.');
        await prisma.$disconnect();
        process.exit(1);
    }

    if (!enableWrite) {
        const staleCount = await prisma.copyTrade.count({
            where: {
                status: 'PENDING',
                expiresAt: { lt: new Date() },
            },
        });
        console.log(`Stale PENDING trades (all configs): ${staleCount}`);
        console.log('Run with VERIFY_PREWRITE_WRITE=true and VERIFY_CONFIG_ID to execute the prewrite/expiry verification steps.');
        await prisma.$disconnect();
        return;
    }

    const config = await prisma.copyTradingConfig.findUnique({
        where: { id: configId },
        select: { id: true, walletAddress: true, traderAddress: true },
    });

    if (!config) {
        console.error(`No CopyTradingConfig found for id=${configId}`);
        await prisma.$disconnect();
        process.exit(1);
    }

    console.log(`Config OK: ${config.id} (wallet=${config.walletAddress})`);

    const now = new Date();
    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const pastExpiry = new Date(Date.now() - 60 * 1000);

    const idempotencyKey = buildKey('base');
    const staleKey = buildKey('stale');

    console.log('Creating prewrite record...');
    const baseTrade = await prisma.copyTrade.create({
        data: {
            configId,
            idempotencyKey,
            originalTrader: config.traderAddress,
            originalSide: 'BUY',
            leaderSide: 'BUY',
            originalSize: 1,
            originalPrice: 0.5,
            copySize: 1,
            copyPrice: 0.5,
            status: 'PENDING',
            expiresAt: futureExpiry,
        },
        select: { id: true },
    });
    console.log(`Created CopyTrade: ${baseTrade.id}`);

    console.log('Attempting duplicate prewrite (expect unique constraint)...');
    try {
        await prisma.copyTrade.create({
            data: {
                configId,
                idempotencyKey,
                originalTrader: config.traderAddress,
                originalSide: 'BUY',
                leaderSide: 'BUY',
                originalSize: 1,
                originalPrice: 0.5,
                copySize: 1,
                copyPrice: 0.5,
                status: 'PENDING',
                expiresAt: futureExpiry,
            },
        });
        console.error('❌ Duplicate create unexpectedly succeeded.');
    } catch (error: any) {
        if (error?.code === 'P2002') {
            console.log('✅ Duplicate prewrite blocked by unique constraint (P2002).');
        } else {
            console.error('❌ Unexpected error on duplicate prewrite:', error);
        }
    }

    console.log('Creating stale PENDING record...');
    const staleTrade = await prisma.copyTrade.create({
        data: {
            configId,
            idempotencyKey: staleKey,
            originalTrader: config.traderAddress,
            originalSide: 'BUY',
            leaderSide: 'BUY',
            originalSize: 1,
            originalPrice: 0.5,
            copySize: 1,
            copyPrice: 0.5,
            status: 'PENDING',
            expiresAt: pastExpiry,
            errorMessage: null,
        },
        select: { id: true },
    });
    console.log(`Created stale CopyTrade: ${staleTrade.id}`);

    console.log('Expiring stale PENDING records created by this script...');
    const updateResult = await prisma.copyTrade.updateMany({
        where: {
            status: 'PENDING',
            expiresAt: { lt: now },
            idempotencyKey: { startsWith: PREFIX },
        },
        data: {
            status: 'FAILED',
            errorMessage: 'PENDING_EXPIRED',
        },
    });
    console.log(`Expired ${updateResult.count} stale records.`);

    const expired = await prisma.copyTrade.findUnique({
        where: { id: staleTrade.id },
        select: { status: true, errorMessage: true },
    });
    console.log(`Stale record status: ${expired?.status} (${expired?.errorMessage})`);

    console.log('Cleaning up verification records...');
    await prisma.copyTrade.deleteMany({
        where: {
            idempotencyKey: { in: [idempotencyKey, staleKey] },
        },
    });
    console.log('✅ Cleanup complete.');

    await prisma.$disconnect();
}

main()
    .catch((error) => {
        console.error('Verification failed:', error);
        process.exit(1);
    })
    .finally(() => {});
