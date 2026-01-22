import './env-setup'; // Load Env FIRST
import { ethers } from 'ethers';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service';
import { TradingService } from '../../src/services/trading-service';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache } from '../../src/core/unified-cache';
import { CONTRACT_ADDRESSES, PROXY_FACTORY_ABI } from '../../src/core/contracts';

async function main() {
    console.log('🧪 Starting Worker Execution Test...');

    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
    const PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
    const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1337');

    if (!PRIVATE_KEY) throw new Error('Missing TRADING_PRIVATE_KEY');

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Address: ${wallet.address}`);
    console.log(`Chain ID: ${CHAIN_ID}`);
    const network = await provider.getNetwork();
    console.log(`Connected to: ${network.chainId}`);

    // Init Services
    const rateLimiter = new RateLimiter();
    const cache = createUnifiedCache();
    const tradingService = new TradingService(rateLimiter, cache, {
        privateKey: PRIVATE_KEY,
        chainId: CHAIN_ID
    });

    // We need to initialize tradingService to load contract addresses properly if they are dynamic
    // But here we rely on CONTRACT_ADDRESSES const or env vars.

    const executionService = new CopyTradingExecutionService(tradingService, wallet, CHAIN_ID);

    // 1. Check/Create Proxy
    console.log('🔍 Checking Proxy...');
    let proxy = await executionService.resolveProxyAddress(wallet.address);
    if (!proxy) {
        console.log('⚠️ No Proxy found. Creating one...');
        const factoryAddr = process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS || CONTRACT_ADDRESSES.polygon.proxyFactory;
        const factory = new ethers.Contract(factoryAddr, PROXY_FACTORY_ABI, wallet);
        const tx = await factory.createProxy(0); // 0 = Standard Tier? Or whatever
        console.log('   Tx sent:', tx.hash);
        await tx.wait();
        console.log('✅ Proxy Created!');

        // Short delay for indexing?
        proxy = await executionService.resolveProxyAddress(wallet.address);
        console.log('   New Proxy:', proxy);
    } else {
        console.log('✅ Proxy found:', proxy);
    }

    if (!proxy) throw new Error("Failed to resolve proxy after creation");

    // Mock Trade
    // Mock Trade
    const mockTokenId = '1234567890123456789012345678901234567890';

    console.log('🚀 Executing Mock Trade...');

    try {
        const result = await executionService.executeOrderWithProxy({
            tradeId: 'test-' + Date.now(),
            walletAddress: wallet.address,
            tokenId: mockTokenId,
            side: 'BUY',
            amount: 10.0, // $10 USDC
            price: 0.5,
            orderType: 'market',
            slippage: 0.01,
            slippageMode: 'FIXED',
            maxSlippage: 2.0
        });

        console.log('---------------------------------------------------');
        if (result.success) {
            console.log('✅ Execution SUCCESS');
            console.log('Tx Hashes:', result.transactionHashes);
        } else {
            console.error('❌ Execution FAILED');
            console.error('Error:', result.error);
        }
        console.log('---------------------------------------------------');

    } catch (e) {
        console.error('💥 Crash during execution:', e);
    }
}

main().catch(console.error);
