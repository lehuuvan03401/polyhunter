import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_RETRY_ATTEMPTS = parseInt(process.env.COPY_TRADING_MAX_RETRY_ATTEMPTS || '2', 10);

async function main() {
    const now = new Date();
    const pendingRetries = await prisma.copyTrade.findMany({
        where: {
            status: 'FAILED',
            retryCount: { lt: MAX_RETRY_ATTEMPTS },
            OR: [
                { nextRetryAt: null },
                { nextRetryAt: { lte: now } },
            ],
        },
        orderBy: { nextRetryAt: 'asc' },
        take: 20,
        select: {
            id: true,
            retryCount: true,
            nextRetryAt: true,
            errorMessage: true,
        },
    });

    if (pendingRetries.length === 0) {
        console.log('No pending retries.');
        return;
    }

    console.log(`Pending retries: ${pendingRetries.length}`);
    for (const trade of pendingRetries) {
        console.log(`${trade.id} | retry=${trade.retryCount} | next=${trade.nextRetryAt} | error=${trade.errorMessage}`);
    }
}

main()
    .catch((error) => {
        console.error('Retry verification failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
