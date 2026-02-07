import 'dotenv/config';

import { ethers } from 'ethers';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service.js';

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL || '';
    if (!databaseUrl || !/^(postgres|postgresql):\/\//i.test(databaseUrl)) {
        throw new Error('DATABASE_URL not set or invalid.');
    }

    const prismaModule: any = await import('../../frontend/lib/prisma.ts');
    const prisma = prismaModule.prisma ?? prismaModule.default?.prisma;
    if (!prisma) {
        throw new Error('Failed to load Prisma client from frontend/lib/prisma.');
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || 1337);
    const privateKey = process.env.TRADING_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('TRADING_PRIVATE_KEY missing.');
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const tradingService = {
        async getBalanceAllowance() {
            return { allowance: '1000000000' };
        },
        async verifyAndApproveAllowance() {
            return true;
        },
        async createMarketOrder() {
            return { success: true, orderId: `mock-${Date.now()}`, transactionHashes: ['0xmock'] };
        },
        async getOrderBook() {
            return null;
        }
    } as any;

    const executionService = new CopyTradingExecutionService(tradingService, signer, chainId);

    const walletAddress = (process.env.TEST_WALLET_ADDRESS || await signer.getAddress()).toLowerCase();
    const proxyAddress = await executionService.resolveProxyAddress(walletAddress);
    if (!proxyAddress) {
        throw new Error('Proxy not found for test wallet.');
    }

    const config = await prisma.copyTradingConfig.findFirst({
        where: { walletAddress },
        select: { id: true, traderAddress: true },
    });
    if (!config) {
        throw new Error('CopyTradingConfig missing for test wallet.');
    }

    const makeTrade = async (amount: number) => prisma.copyTrade.create({
        data: {
            configId: config.id,
            originalTrader: config.traderAddress,
            originalSide: 'BUY',
            leaderSide: 'BUY',
            originalSize: amount,
            originalPrice: 0.5,
            tokenId: 'ledger-test-token',
            copySize: amount,
            copyPrice: 0.5,
            status: 'EXECUTED',
            usedBotFloat: true,
            executedAt: new Date(),
        },
    });

    const tradeOne = await makeTrade(1);
    const tradeTwo = await makeTrade(2);

    const botAddress = await signer.getAddress();

    const entryOne = await prisma.reimbursementLedger.create({
        data: {
            copyTradeId: tradeOne.id,
            proxyAddress,
            botAddress,
            amount: 1,
            currency: 'USDC',
            status: 'PENDING',
        },
    });

    const entryTwo = await prisma.reimbursementLedger.create({
        data: {
            copyTradeId: tradeTwo.id,
            proxyAddress,
            botAddress,
            amount: 2,
            currency: 'USDC',
            status: 'PENDING',
        },
    });

    console.log(`[Verify] Created ledger entries ${entryOne.id}, ${entryTwo.id}.`);

    const totalAmount = 3;
    console.log(`[Verify] Flushing batch reimbursement: $${totalAmount.toFixed(2)}`);
    const result = await executionService.transferFromProxy(proxyAddress, totalAmount, signer);

    if (!result.success) {
        throw new Error(`Ledger reimbursement failed: ${result.error || 'unknown'}`);
    }

    await prisma.reimbursementLedger.updateMany({
        where: { id: { in: [entryOne.id, entryTwo.id] } },
        data: {
            status: 'SETTLED',
            settledAt: new Date(),
            txHash: result.txHash,
            errorLog: null,
        },
    });

    console.log(`[Verify] Ledger batch settled: ${result.txHash}`);

    const txMonitor = (executionService as any).txMonitor;
    if (txMonitor?.stop) {
        txMonitor.stop();
    }
    process.exit(0);
}

main()
    .catch((error) => {
        console.error('[Verify] Failed:', error?.message || error);
        process.exit(1);
    })
    .finally(async () => {
        const prismaModule: any = await import('../../frontend/lib/prisma.ts');
        const prismaClient = prismaModule.prisma ?? prismaModule.default?.prisma;
        await prismaClient?.$disconnect().catch(() => null);
    });
