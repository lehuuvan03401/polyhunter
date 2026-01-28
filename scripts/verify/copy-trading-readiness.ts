import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { TradingService } from '../../src/services/trading-service.js';
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service.js';
import { RateLimiter } from '../../src/core/rate-limiter.js';
import { createUnifiedCache } from '../../src/core/unified-cache.js';
import { CONTRACT_ADDRESSES, ERC20_ABI, CTF_ABI, USDC_DECIMALS } from '../../src/core/contracts.js';

const RPC_URLS = (process.env.COPY_TRADING_RPC_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
const FALLBACK_RPC = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137', 10);
const ENABLE_REAL_TRADING = process.env.ENABLE_REAL_TRADING === 'true';
const EXECUTION_ALLOWLIST = (process.env.COPY_TRADING_EXECUTION_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const MAX_TRADE_USD = Number(process.env.COPY_TRADING_MAX_TRADE_USD || '0');

const prisma = new PrismaClient();

async function selectExecutionRpc(timeoutMs: number = 2000): Promise<string> {
    const candidates = RPC_URLS.length > 0 ? RPC_URLS : [FALLBACK_RPC];

    for (const url of candidates) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), timeoutMs)),
            ]);
            return url;
        } catch (error) {
            console.warn(`[Readiness] RPC unhealthy, skipping: ${url}`);
        }
    }

    return FALLBACK_RPC;
}

async function main() {
    const issues: string[] = [];

    if (!ENABLE_REAL_TRADING) {
        issues.push('REAL_TRADING_DISABLED');
    }

    if (!TRADING_PRIVATE_KEY) {
        issues.push('TRADING_PRIVATE_KEY missing');
    }

    const rpcUrl = await selectExecutionRpc();
    console.log(`RPC: ${rpcUrl}`);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    const wallet = TRADING_PRIVATE_KEY ? new ethers.Wallet(TRADING_PRIVATE_KEY, provider) : null;
    const walletAddress = wallet ? await wallet.getAddress() : null;

    if (!walletAddress) {
        issues.push('Wallet not available');
    } else {
        if (EXECUTION_ALLOWLIST.length > 0 && !EXECUTION_ALLOWLIST.includes(walletAddress.toLowerCase())) {
            issues.push('ALLOWLIST_BLOCKED');
        }
    }

    const rateLimiter = new RateLimiter();
    const cache = createUnifiedCache();
    const tradingService = TRADING_PRIVATE_KEY
        ? new TradingService(rateLimiter, cache, { privateKey: TRADING_PRIVATE_KEY, chainId: CHAIN_ID })
        : null;
    if (tradingService) await tradingService.initialize();

    if (!wallet) {
        throw new Error('Wallet missing. Cannot continue readiness checks.');
    }

    const executionService = new CopyTradingExecutionService(tradingService!, wallet, CHAIN_ID);

    const proxyAddress = await executionService.resolveProxyAddress(wallet.address);
    if (!proxyAddress) {
        issues.push('NO_PROXY');
    } else {
        console.log(`Proxy: ${proxyAddress}`);
    }

    if (proxyAddress) {
        const proxyUsdc = await executionService.getProxyUsdcBalance(proxyAddress).catch(() => 0);
        console.log(`Proxy USDC: $${proxyUsdc.toFixed(2)}`);
        if (proxyUsdc < 1) {
            issues.push('PROXY_USDC_LOW');
        }

        const addresses = (CHAIN_ID === 137 || CHAIN_ID === 31337 || CHAIN_ID === 1337)
            ? CONTRACT_ADDRESSES.polygon
            : CONTRACT_ADDRESSES.amoy;

        if (!addresses.executor) {
            issues.push('EXECUTOR_NOT_CONFIGURED');
        } else {
            if (addresses.usdc) {
                const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, provider);
                const allowanceRaw = await usdc.allowance(proxyAddress, addresses.executor);
                const allowance = Number(allowanceRaw) / (10 ** USDC_DECIMALS);
                console.log(`USDC allowance (proxy -> executor): ${allowance}`);
                if (allowance <= 0) {
                    issues.push('ALLOWANCE_MISSING_USDC');
                }
            }

            const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);
            const approved = await ctf.isApprovedForAll(proxyAddress, addresses.executor);
            console.log(`CTF approval (proxy -> executor): ${approved}`);
            if (!approved) {
                issues.push('ALLOWANCE_MISSING_CTF');
            }
        }
    }

    if (MAX_TRADE_USD > 0) {
        console.log(`Max trade cap: ${MAX_TRADE_USD}`);
    }

    if (issues.length > 0) {
        console.error('\n❌ Readiness check failed:');
        for (const issue of issues) {
            console.error(`- ${issue}`);
        }
        process.exit(1);
    }

    console.log('\n✅ Readiness check passed.');
}

main()
    .catch((error) => {
        console.error('Readiness check error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
