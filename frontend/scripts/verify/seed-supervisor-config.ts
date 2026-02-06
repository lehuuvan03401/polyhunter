import 'dotenv/config';

import { prisma, isDatabaseEnabled } from '../../lib/prisma';

const ACTION = (process.env.SUPERVISOR_TEST_CONFIG_ACTION || 'upsert').toLowerCase();
const TRADER = (process.env.SUPERVISOR_TEST_TRADER || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8').toLowerCase();
const WALLET = (process.env.SUPERVISOR_TEST_WALLET || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266').toLowerCase();
const EXECUTION_MODE = (process.env.SUPERVISOR_TEST_EXECUTION_MODE || 'PROXY').toUpperCase();
const FIXED_AMOUNT = Number(process.env.SUPERVISOR_TEST_FIXED_AMOUNT || '1');
const MAX_SIZE = Number(process.env.SUPERVISOR_TEST_MAX_SIZE || '10');
const MAX_SLIPPAGE = Number(process.env.SUPERVISOR_TEST_MAX_SLIPPAGE || '1');

async function main() {
    if (!isDatabaseEnabled) {
        console.error('DATABASE_URL not set or invalid. Aborting.');
        process.exit(1);
    }

    if (ACTION === 'cleanup') {
        const result = await prisma.copyTradingConfig.deleteMany({
            where: {
                walletAddress: WALLET,
                traderAddress: TRADER,
            },
        });
        console.log(`[SeedConfig] Cleanup complete. Removed ${result.count} configs.`);
        return;
    }

    await prisma.copyTradingConfig.deleteMany({
        where: {
            walletAddress: WALLET,
            traderAddress: TRADER,
        },
    });

    const created = await prisma.copyTradingConfig.create({
        data: {
            walletAddress: WALLET,
            traderAddress: TRADER,
            traderName: 'dedup-test-trader',
            mode: 'FIXED_AMOUNT',
            fixedAmount: Number.isFinite(FIXED_AMOUNT) ? FIXED_AMOUNT : 1,
            maxSizePerTrade: Number.isFinite(MAX_SIZE) ? MAX_SIZE : 10,
            slippageType: 'FIXED',
            maxSlippage: Number.isFinite(MAX_SLIPPAGE) ? MAX_SLIPPAGE : 1,
            autoExecute: true,
            channel: 'EVENT_LISTENER',
            isActive: true,
            executionMode: EXECUTION_MODE as any,
            strategyProfile: 'CONSERVATIVE' as any,
        },
    });

    console.log(`[SeedConfig] Created config ${created.id} for wallet=${WALLET} trader=${TRADER}`);
}

main()
    .catch((err) => {
        console.error('Seed config failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect().catch(() => null);
    });
