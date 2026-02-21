import 'dotenv/config';

import { ethers } from 'ethers';
import { createRequire } from 'module';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service.js';
import { CONTRACT_ADDRESSES } from '../../src/core/contracts.js';

const require = createRequire(import.meta.url);

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

    const mockArtifact = require('../../contracts/artifacts/contracts/mocks/MockCTF.sol/MockCTF.json');
    const ctfAddress = process.env.NEXT_PUBLIC_CTF_ADDRESS
        || process.env.CTF_ADDRESS
        || CONTRACT_ADDRESSES.ctf;

    console.log('[Verify] Hot-swapping CTF with MockCTF...');
    await provider.send('hardhat_setCode', [ctfAddress, mockArtifact.deployedBytecode]);

    const tradingService = {
        async getBalanceAllowance() {
            return { allowance: '1000000000' };
        },
        async createMarketOrder() {
            return { success: true, orderId: `mock-${Date.now()}`, transactionHashes: ['0xmock'] };
        },
        async getOrderBook() {
            return null;
        }
    } as any;

    const executionService = new CopyTradingExecutionService(tradingService, signer, chainId);

    const walletAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const proxyAddress = await executionService.resolveProxyAddress(walletAddress);
    if (!proxyAddress) {
        throw new Error('Proxy not found for test wallet.');
    }

    const config = await prisma.copyTradingConfig.findFirst({
        where: { walletAddress: walletAddress.toLowerCase() },
        select: { id: true, traderAddress: true },
    });
    if (!config) {
        throw new Error('CopyTradingConfig missing for test wallet.');
    }

    const tokenId = '12345';
    const amount = 10;
    const price = 0.5;

    console.log('[Verify] Executing trade with async settlement...');
    const execResult = await executionService.executeOrderWithProxy({
        tradeId: 'async-settlement-test',
        walletAddress,
        tokenId,
        side: 'BUY',
        amount,
        price,
        proxyAddress,
        slippageMode: 'FIXED',
        maxSlippage: 2,
        deferSettlement: true,
    });

    if (!execResult.success) {
        throw new Error(`Execution failed: ${execResult.error || 'unknown'}`);
    }
    if (!execResult.settlementDeferred) {
        throw new Error('Expected settlementDeferred=true when deferSettlement is enabled.');
    }

    const trade = await prisma.copyTrade.create({
        data: {
            configId: config.id,
            originalTrader: config.traderAddress,
            originalSide: 'BUY',
            originalSize: amount,
            originalPrice: price,
            tokenId,
            copySize: amount,
            copyPrice: price,
            status: 'SETTLEMENT_PENDING',
            errorMessage: 'Settlement Pending',
            usedBotFloat: execResult.usedBotFloat ?? false,
            executedAt: new Date(),
        },
    });

    console.log(`[Verify] Created SETTLEMENT_PENDING trade ${trade.id}.`);

    if (process.env.SKIP_RECOVERY === 'true') {
        console.log('[Verify] SKIP_RECOVERY enabled; leaving trade in SETTLEMENT_PENDING.');
        const txMonitor = (executionService as any).txMonitor;
        if (txMonitor?.stop) {
            txMonitor.stop();
        }
        process.exit(0);
    }

    console.log('[Verify] Running settlement recovery...');
    const recovery = await executionService.recoverSettlement(
        proxyAddress,
        'BUY',
        tokenId,
        amount,
        price,
        execResult.usedBotFloat ?? false
    );

    if (!recovery.success) {
        throw new Error(`Settlement recovery failed: ${recovery.error || 'unknown'}`);
    }

    await prisma.copyTrade.update({
        where: { id: trade.id },
        data: {
            status: 'EXECUTED',
            txHash: recovery.txHash,
            errorMessage: null,
        },
    });

    console.log(`[Verify] Settlement recovered. Trade ${trade.id} marked EXECUTED.`);

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
