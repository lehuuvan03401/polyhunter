import '../env/env-setup';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TradingService } from '../../../sdk/src/services/trading-service';
import { CopyTradingExecutionService } from '../../../sdk/src/services/copy-trading-execution-service';
import { CONTRACT_ADDRESSES, POLY_HUNTER_PROXY_ABI, CTF_ABI } from '../../../sdk/src/core/contracts';
import { RateLimiter } from '../../../sdk/src/core/rate-limiter';
import { createUnifiedCache } from '../../../sdk/src/core/unified-cache';
import readline from 'readline';

// dotenv.config() handled by env-setup

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const REQUIRED_ENV_VARS = ['TRADING_PRIVATE_KEY', 'NEXT_PUBLIC_RPC_URL', 'DATABASE_URL'];
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
const ctfAddress = process.env.NEXT_PUBLIC_CTF_ADDRESS || CONTRACT_ADDRESSES.ctf;

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

    // 5. Check Allowances (Critical)
    console.log(`\n🔐 Checking Allowances...`);
    const usdcCheck = await executionService.checkProxyAllowance({
        proxyAddress,
        side: 'BUY',
        tokenId: "0", // Invalid Token ID, but checkProxyAllowance only needs it for conditional tokens? No, for BUY it checks USDC.
        amount: 1000000, // 1000k Check
        signer: wallet
    });

    if (!usdcCheck.allowed) {
        console.warn(`⚠️  USDC Allowance Missing or Low! (${usdcCheck.reason})`);
        console.warn(`   You MUST approve the Exchange to spend your Proxy's USDC.`);
        const approve = await question("   Attempt Auto-Approve USDC? (y/n): ");
        if (approve.toLowerCase() === 'y') {
            try {
                if (!addresses.executor) {
                    throw new Error('Executor address not configured');
                }
                const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, wallet);
                const tx = await proxy.approveTrading(addresses.executor, ethers.constants.MaxUint256);
                console.log(`   🔁 Approving USDC... Tx: ${tx.hash}`);
                await tx.wait();
                console.log("   ✅ USDC Approve Success");
            } catch (err: any) {
                console.error("   ❌ Auto-Approve USDC failed:", err.message || err);
            }
        }
    } else {
        console.log(`✅ USDC Approved (Allowance: ${usdcCheck.allowance})`);
    }

    const ctfCheck = await executionService.checkProxyAllowance({
        proxyAddress,
        side: 'SELL',
        tokenId: "0", // CTF check usually checks "setApprovalForAll" which ignores token ID
        amount: 0,
        signer: wallet
    });

    if (!ctfCheck.allowed) {
        console.warn(`⚠️  CTF Allowance Missing! (${ctfCheck.reason})`);
        console.warn(`   You MUST approve the Exchange to spend your Conditional Tokens.`);
        const approve = await question("   Attempt Auto-Approve CTF? (y/n): ");
        if (approve.toLowerCase() === 'y') {
            try {
                if (!addresses.executor) {
                    throw new Error('Executor address not configured');
                }
                if (!ctfAddress) {
                    throw new Error('CTF address not configured');
                }
                const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, wallet);
                const ctfIface = new ethers.utils.Interface(CTF_ABI);
                const data = ctfIface.encodeFunctionData('setApprovalForAll', [addresses.executor, true]);
                const tx = await proxy.execute(ctfAddress, data);
                console.log(`   🔁 Approving CTF... Tx: ${tx.hash}`);
                await tx.wait();
                console.log("   ✅ CTF Approve Success");
            } catch (err: any) {
                console.error("   ❌ Auto-Approve CTF failed:", err.message || err);
            }
        }
    } else {
        console.log(`✅ CTF Approved`);
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

    const maxSlippageInput = await question("📉 Max Slippage % (default 1.0): ");
    const maxSlippage = maxSlippageInput ? Number(maxSlippageInput) : 1.0;

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
                maxSlippage: Number.isFinite(maxSlippage) ? maxSlippage : 1.0,
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
                maxSlippage: Number.isFinite(maxSlippage) ? maxSlippage : 1.0,
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
    console.log(`export COPY_TRADING_DRY_RUN=true  # Optional: dry-run mode, no real orders`);
    console.log(`cd web && npx tsx scripts/workers/copy-trading-worker.ts`);

    process.exit(0);
}

main().catch(console.error);
