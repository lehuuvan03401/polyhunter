
/**
 * Copy Trading Worker (Standalone)
 * 
 * Listens to Real-time Blockchain Events to trigger Copy Trades immediately.
 * 
 * Usage: npx ts-node scripts/copy-trading-worker.ts
 */

import '../env/env-setup'; // Load Env FIRST
import { getStrategyConfig } from '../../../sdk/src/config/strategy-profiles.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

import { CONTRACT_ADDRESSES, CTF_ABI } from '../../../sdk/src/core/contracts';
import { CopyTradingExecutionService } from '../../../sdk/src/services/copy-trading-execution-service';
import { TradingService } from '../../../sdk/src/services/trading-service';
import { RateLimiter } from '../../../sdk/src/core/rate-limiter';
import { createUnifiedCache } from '../../../sdk/src/core/unified-cache';
import { PositionService } from '../../lib/services/position-service';
import { GuardrailService } from '../../lib/services/guardrail-service';
import { RealtimeServiceV2, ActivityTrade, MarketEvent } from '../../../sdk/src/services/realtime-service-v2';
import { TokenMetadataService } from '../../../sdk/src/services/token-metadata-service';
import { MarketService } from '../../../sdk/src/services/market-service';
import { DataApiClient } from '../../../sdk/src/clients/data-api';
import { GammaApiClient } from '../../../sdk/src/index';
import { getSpeedProfile } from '../../config/speed-profile';
import { TradeOrchestrator } from '../../../sdk/src/core/trade-orchestrator.js';

// --- CONFIG ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const POLL_INTERVAL_MS = 30000; // Refresh configs every 30s
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const DRY_RUN = process.env.COPY_TRADING_DRY_RUN === 'true';
const speedProfile = getSpeedProfile();
const CLOB_API_KEY = process.env.POLY_API_KEY || process.env.CLOB_API_KEY;
const CLOB_API_SECRET = process.env.POLY_API_SECRET || process.env.CLOB_API_SECRET;
const CLOB_API_PASSPHRASE = process.env.POLY_API_PASSPHRASE || process.env.CLOB_API_PASSPHRASE;
const clobCredentials = CLOB_API_KEY && CLOB_API_SECRET && CLOB_API_PASSPHRASE
    ? { key: CLOB_API_KEY, secret: CLOB_API_SECRET, passphrase: CLOB_API_PASSPHRASE }
    : undefined;

if (!TRADING_PRIVATE_KEY) {
    console.error('Missing TRADING_PRIVATE_KEY env var');
    process.exit(1);
}

// --- INITIALIZATION ---
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
    log: ['info', 'warn', 'error'],
});
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(TRADING_PRIVATE_KEY, provider);
const WORKER_ADDRESS = signer.address;

// Services
const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const positionService = new PositionService(prisma);
const tradingService = new TradingService(rateLimiter, cache, {
    privateKey: TRADING_PRIVATE_KEY,
    chainId: CHAIN_ID,
    credentials: clobCredentials,
});
const executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID);
const realtimeService = new RealtimeServiceV2({ autoReconnect: true });
const gammaClient = new GammaApiClient(rateLimiter, cache);
const dataApi = new DataApiClient(rateLimiter, cache);
const marketService = new MarketService(gammaClient, dataApi, rateLimiter, cache);
const tokenMetadataService = new TokenMetadataService(marketService, cache);
const tradeOrchestrator = new TradeOrchestrator(executionService, tokenMetadataService, tradingService, prisma, speedProfile, false);

// State
let activeConfigs: any[] = [];
let monitoredAddresses: Set<string> = new Set();
let isProcessing = false;

// --- HELPERS ---
const toNumber = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

async function refreshConfigs() {
    try {
        const configs = await prisma.copyTradingConfig.findMany({
            where: {
                isActive: true,
                autoExecute: true
            }
        });

        activeConfigs = configs;
        monitoredAddresses = new Set(configs.map(c => c.traderAddress.toLowerCase()));

        console.log(`[Worker] Refreshed configs: ${configs.length} active auto-execute strategies.`);
        console.log(`[Worker] Monitoring ${monitoredAddresses.size} unique traders.`);
    } catch (e) {
        console.error('[Worker] Failed to refresh configs:', e);
    }
}

async function resolveConfigIdForPosition(walletAddress: string, tokenId: string): Promise<string | null> {
    const normalizedWallet = walletAddress.toLowerCase();

    const recentTrade = await prisma.copyTrade.findFirst({
        where: {
            tokenId,
            config: { walletAddress: normalizedWallet }
        },
        orderBy: { detectedAt: 'desc' },
        select: { configId: true }
    });

    if (recentTrade?.configId) return recentTrade.configId;

    const config = await prisma.copyTradingConfig.findFirst({
        where: { walletAddress: normalizedWallet },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
    });

    return config?.id || null;
}

// ============================================================================
// Settlement Handler
// ============================================================================

const SETTLEMENT_CACHE = new Set<string>();
const SETTLEMENT_QUEUE: string[] = [];
let isProcessingSettlement = false;

function handleMarketResolution(event: MarketEvent): void {
    if (event.type !== 'resolved') return;

    const conditionId = event.conditionId;
    if (SETTLEMENT_CACHE.has(conditionId)) return;
    SETTLEMENT_CACHE.add(conditionId);

    console.log(`\n⚖️ [Settlement] Market Resolved: ${conditionId}. Queueing for async settlement.`);
    SETTLEMENT_QUEUE.push(conditionId);
}

async function processSettlementQueue() {
    if (isProcessingSettlement || SETTLEMENT_QUEUE.length === 0) return;
    isProcessingSettlement = true;

    try {
        const conditionId = SETTLEMENT_QUEUE.shift();
        if (conditionId) {
            await resolvePositions(conditionId);
        }
    } catch (error) {
        console.error(`   ❌ Failed to settle positions:`, error);
    } finally {
        isProcessingSettlement = false;
    }
}

// Start background settlement processor
setInterval(processSettlementQueue, 5000);

async function resolvePositions(conditionId: string): Promise<void> {
    console.log(`\n🔍 Resolving positions for condition ${conditionId}...`);

    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const market = await gammaClient.getMarketByConditionId(conditionId);

        if (!market) {
            console.warn(`   ⚠️ Market not found in Gamma API: ${conditionId}`);
            return;
        }

        console.log(`   Market: ${market.question}`);
        console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
        console.log(`   Prices: ${market.outcomePrices.join(', ')}`);
        console.log(`   Closed: ${market.closed}`);

        // Map Outcomes to Token IDs
        const relevantTrades = await prisma.copyTrade.findMany({
            where: { conditionId: conditionId },
            select: { tokenId: true, outcome: true },
            distinct: ['tokenId']
        });

        const outcomeToTokenMap = new Map<string, string>();
        relevantTrades.forEach((t) => {
            if (t.outcome && t.tokenId) {
                outcomeToTokenMap.set(t.outcome, t.tokenId);
            }
        });

        // Determine winners
        for (let i = 0; i < market.outcomes.length; i++) {
            const outcomeName = market.outcomes[i];
            const price = Number(market.outcomePrices[i]);
            const tokenId = outcomeToTokenMap.get(outcomeName);

            // Check for explicit winner flag if available in tokens
            const tokenData = (market as any).tokens?.find((t: any) => t.tokenId === tokenId || t.token_id === tokenId);
            const isWinnerInfo = tokenData?.winner;

            if (!tokenId) continue;

            let settlementType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
            let settlementValue = 0.0;

            // Robust Winner Logic matches Simulation
            if (price >= 0.95 || isWinnerInfo === true) {
                settlementType = 'WIN';
                settlementValue = 1.0;
            } else if (price <= 0.05 || (isWinnerInfo === false && market.closed)) {
                settlementType = 'LOSS';
                settlementValue = 0.0;
            } else {
                continue; // Uncertain
            }

            // Find positions
            const positions = await prisma.userPosition.findMany({
                where: { tokenId: tokenId, balance: { gt: 0 } }
            });

            if (positions.length === 0) continue;

            console.log(`   Processing ${positions.length} positions for '${outcomeName}' (Token: ${tokenId.slice(0, 10)}...). Type: ${settlementType}`);

            for (const pos of positions) {
                let txHash = settlementType === 'LOSS' ? 'settled-loss' : 'redeem-pending';
                let errorMsg: string | undefined = undefined;

                const proceeds = pos.balance * settlementValue;
                const pnl = proceeds - pos.totalCost;

                const configId = await resolveConfigIdForPosition(pos.walletAddress, tokenId);
                if (!configId) {
                    console.warn(`     ⚠️ No config found for ${pos.walletAddress}. Skipping settlement record.`);
                    continue;
                }

                // 1. ON-CHAIN EXECUTION (Only for Wins)
                if (settlementType === 'WIN') {
                    console.log(`     🎉 Executing On-Chain Redemption for ${pos.walletAddress}...`);

                    // Resolve Proxy
                    const proxyAddress = await executionService.resolveProxyAddress(pos.walletAddress);
                    if (proxyAddress) {
                        const indexSet = [1 << i]; // Bitmask for index i
                        const result = await executionService.redeemPositions(
                            proxyAddress,
                            conditionId,
                            indexSet
                        );

                        if (result.success) {
                            txHash = result.txHash || 'redeem-tx';
                            console.log(`       ✅ Tx: ${txHash}`);
                        } else {
                            console.error(`       ❌ Redemption Failed: ${result.error}`);
                            errorMsg = result.error;
                        }
                    } else {
                        console.error(`       ❌ No Proxy found for ${pos.walletAddress}`);
                        errorMsg = "No Proxy Found";
                    }
                }

                // 2. Log Settlement Trade
                await prisma.copyTrade.create({
                    data: {
                        configId: configId,
                        originalTrader: 'POLYMARKET_SETTLEMENT',
                        originalSide: 'SELL', // Settlement is effectively a sell
                        originalSize: pos.balance,
                        originalPrice: settlementValue,
                        marketSlug: market.slug,
                        conditionId: conditionId,
                        tokenId: tokenId,
                        outcome: outcomeName,
                        copySize: proceeds,
                        copyPrice: settlementValue,
                        status: (errorMsg ? 'FAILED' : 'EXECUTED'),
                        executedAt: new Date(),
                        txHash: txHash,
                        errorMessage: errorMsg || (settlementType === 'WIN' ? `Redeemed (Profit $${pnl.toFixed(2)})` : `Settled Loss ($${pnl.toFixed(2)})`),
                        realizedPnL: errorMsg ? undefined : pnl
                    }
                });

                if (settlementType === 'WIN' && errorMsg) {
                    console.warn(`       ⚠️ Skipping DB deletion due to on-chain failure.`);
                    continue;
                }

                await prisma.userPosition.delete({
                    where: { id: pos.id }
                });

                console.log(`     ✅ DB Updated: PnL $${pnl.toFixed(2)}`);
            }
        }
    } catch (error) {
        console.error(`   ❌ Error in resolvePositions:`, error);
    }
}

// --- EVENT LISTENER ---

async function startListener() {
    // 1. Initialize Services
    if (!clobCredentials && !DRY_RUN) {
        console.warn('[Worker] ⚠️ Missing CLOB API credentials. Will attempt to derive at startup.');
    }
    try {
        await tradingService.initialize();
    } catch (error) {
        console.error('[Worker] ❌ TradingService initialization failed (CLOB auth).', error);
        console.error('[Worker] ➜ Set POLY_API_KEY / POLY_API_SECRET / POLY_API_PASSPHRASE in frontend/.env or ensure the wallet can create CLOB API keys.');
        if (!DRY_RUN) {
            process.exit(1);
        }
    }
    await refreshConfigs();
    console.log(`[Worker] ⚡ Speed profile: ${speedProfile.name} | maxSpreadBps=${speedProfile.maxSpreadBps} | minDepthUsd=${speedProfile.minDepthUsd} | minDepthRatio=${speedProfile.minDepthRatio}`);

    // Pre-warm token metadata cache to prevent event-loop blocking on first trades
    await tokenMetadataService.prewarmCache();
    setInterval(() => tokenMetadataService.prewarmCache(), 600000);

    // 2. Setup WebSocket Listener
    console.log('[Worker] 🔌 Connecting to Polymarket WebSocket...');
    realtimeService.connect();

    realtimeService.subscribeAllActivity({
        onTrade: async (trade) => {
            try {
                await handleWebsocketTrade(trade);
            } catch (err) {
                console.error('[Worker] Error handling trade:', err);
            }
        },
        onError: (err) => {
            console.error('[Worker] ❌ WebSocket error:', err);
        }
    });

    // Subscribe to Market Events
    console.log('[Worker] 🔌 Subscribing to Market Events...');
    realtimeService.subscribeMarketEvents({
        onMarketEvent: async (event) => {
            try {
                await handleMarketResolution(event);
            } catch (err) {
                console.error('[Worker] Error handling market event:', err);
            }
        }
    });

    console.log('[Worker] 🎧 Listening for Global Trade Activity...');

    // 3. Periodic Config Refresh
    setInterval(refreshConfigs, POLL_INTERVAL_MS);
}

// --- EVENT HANDLER ---

async function handleWebsocketTrade(trade: ActivityTrade) {
    const traderAddress = trade.trader?.address?.toLowerCase();

    if (!traderAddress || !monitoredAddresses.has(traderAddress)) {
        return;
    }

    // Find configs for this trader
    const configs = activeConfigs.filter(c => c.traderAddress.toLowerCase() === traderAddress);

    for (const config of configs) {
        try {
            // Re-map real-time socket payload to the generalized Activity schema expected by Orchestrator
            const mappedTrade = {
                ...trade,
                name: traderAddress,
                slug: trade.marketSlug || '',
            } as any; // Cast as any because Activity schema expects exact matching

            await tradeOrchestrator.evaluateAndExecuteTrade(mappedTrade, config);
        } catch (error) {
            console.error(`[Worker] ❌ Error executing trade for config ${config.id}:`, error);
        }
    }
}

// Start
startListener().catch(console.error);
