import './env-setup';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TradingService } from '../../src/services/trading-service';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service';
import { RateLimiter } from '../../src/core/rate-limiter';
import { createUnifiedCache } from '../../src/core/unified-cache';
import readline from 'readline';

// dotenv.config() handled by env-setup

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const REQUIRED_ENV_VARS = ['TRADING_PRIVATE_KEY', 'NEXT_PUBLIC_RPC_URL', 'DATABASE_URL'];
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const USDC_DECIMALS = 6;
const CONTRACT_ADDRESSES = {
    polygon: {
        usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e
        ctf: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
        proxyFactory: "0xa56375E010260212CF17415f368C93a74695E8c9", // Gnosis Safe Proxy Factory (standard) or Custom
        executor: "0xd8622449a502f430587d4a7c2937012d46698967" // Polymarket Exchange / CTF Exchange
    }
};

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
    console.log("\n🚀 =================================================");
    console.log("   REAL MONEY COPY TRADING SETUP WIZARD (MINIMAL RISK)");
    console.log("   =================================================\n");

    // 1. Env Check
    const missingEnv = REQUIRED_ENV_VARS.filter(k => !process.env[k]);
    if (missingEnv.length > 0) {
        console.error(`❌ Missing ENV vars: ${missingEnv.join(', ')}`);
        console.error(`Please add them to your .env file.`);
        process.exit(1);
    }

    // 2. DB Init (Robust)
    console.log("🔌 Connecting to Database...");
    let prisma: PrismaClient;
    try {
        const rawUrl = process.env.DATABASE_URL || '';
        console.log(`Debug URL: '${rawUrl}'`);
        const pool = new Pool({ connectionString: rawUrl.trim() });
        const adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });
        await prisma.$connect();
        console.log("✅ Database Connected (via PrismaPg Adapter)");
    } catch (e: any) {
        console.error("❌ DB Connection Failed:", e.message);
        console.error("Hints: Check DATABASE_URL username/password/host.");
        process.exit(1);
    }

    // Ethers v5 Syntax
    const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    const wallet = new ethers.Wallet(process.env.TRADING_PRIVATE_KEY!, provider);

    // Initialize Dependencies
    const rateLimiter = new RateLimiter();
    const cache = createUnifiedCache();

    // TradingService(rateLimiter, cache, config)
    const tradingService = new TradingService(
        rateLimiter,
        cache,
        {
            privateKey: process.env.TRADING_PRIVATE_KEY!,
            chainId: CHAIN_ID
        }
    );
    const executionService = new CopyTradingExecutionService(tradingService, wallet, CHAIN_ID);

    const walletAddress = await wallet.getAddress();
    console.log(`\n👤 Wallet: ${walletAddress}`);

    // 2. Check MATIC
    const balance = await provider.getBalance(walletAddress);
    const balanceMatic = Number(ethers.utils.formatEther(balance));
    console.log(`💰 MATIC Balance: ${balanceMatic.toFixed(4)} MATIC`);
    if (balanceMatic < 0.1) {
        console.warn(`⚠️  Low MATIC balance! Recommended > 0.1 MATIC for gas.`);
        const proceed = await question("Continue anyway? (y/n): ");
        if (proceed.toLowerCase() !== 'y') process.exit(0);
    } else {
        console.log(`✅ Gas OK`);
    }

    // 3. Resolve Proxy
    console.log(`\n🔍 Resolving Proxy...`);
    const proxyAddress = await executionService.resolveProxyAddress(walletAddress);

    if (!proxyAddress) {
        console.error(`❌ No Proxy found for this wallet! Please create one in the Dashboard.`);
        process.exit(1);
    }
    console.log(`✅ Proxy Found: ${proxyAddress}`);

    // 4. Check Proxy USDC
    const proxyUsdc = await executionService.getProxyUsdcBalance(proxyAddress);
    console.log(`💵 Proxy USDC Balance: $${proxyUsdc.toFixed(2)}`);
    if (proxyUsdc < 1) {
        console.warn(`⚠️  Proxy balance < $1. You need at least $1 to trade.`);
        const proceed = await question("Continue checks? (y/n): ");
        if (proceed.toLowerCase() !== 'y') process.exit(0);
    } else {
        console.log(`✅ Funds OK`);
    }

    // 5. Config Setup
    console.log(`\n⚙️  Setting up Safe Configuration...`);
    let targetTrader = await question("🎯 Enter Target Trader Address to Copy (or press Enter for default): ");
    if (!targetTrader) {
        targetTrader = "0x63ce342161250d705dc0b16df89036c8e5f9ba9a"; // Default active trader
        console.log(`Using default: ${targetTrader}`);
    }

    if (!ethers.utils.isAddress(targetTrader)) {
        console.error("❌ Invalid address");
        process.exit(1);
    }


    // Check existing config
    const existing = await prisma.copyTradingConfig.findFirst({
        where: {
            walletAddress: walletAddress,
            traderAddress: targetTrader
        }
    });

    if (existing) {
        console.log(`⚠️  Config already exists for this trader.`);
        const overwrite = await question("Overwrite with Safe Mode ($1 Fixed)? (y/n): ");
        if (overwrite.toLowerCase() !== 'y') {
            console.log("Exiting.");
            process.exit(0);
        }

        await prisma.copyTradingConfig.update({
            where: { id: existing.id },
            data: {
                mode: 'FIXED_AMOUNT',
                fixedAmount: 1,
                maxSizePerTrade: 1,
                slippageType: 'FIXED',
                maxSlippage: 1.0,
                autoExecute: true,
                isActive: true, // Make sure it's active
                executionMode: 'PROXY',
                strategyProfile: 'CONSERVATIVE'
            }
        });
        console.log("✅ Config Updated!");
    } else {
        await prisma.copyTradingConfig.create({
            data: {
                walletAddress: walletAddress,
                traderAddress: targetTrader,
                traderName: "Target Trader",
                mode: 'FIXED_AMOUNT',
                fixedAmount: 1,
                maxSizePerTrade: 1,
                slippageType: 'FIXED',
                maxSlippage: 1.0,
                autoExecute: true,
                isActive: true,
                executionMode: 'PROXY',
                strategyProfile: 'CONSERVATIVE'
            }
        });
        console.log("✅ New Safe Config Created!");
    }

    console.log(`\n🎉 Setup Complete!`);
    console.log(`To start trading, run:`);
    console.log(`export TRADING_PRIVATE_KEY=${process.env.TRADING_PRIVATE_KEY}`);
    console.log(`npx tsx scripts/copy-trading-worker.ts`);

    process.exit(0);
}

main().catch(console.error);
