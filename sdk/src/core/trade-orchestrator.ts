import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { CopyTradingExecutionService } from '../services/copy-trading-execution-service.js';
import { TokenMetadataService } from '../services/token-metadata-service.js';
import { TradingService } from '../services/trading-service.js';
import { Activity } from '../clients/data-api.js';

interface SpeedProfile {
    name: string;
    maxSpreadBps: number;
    depthLevels: number;
    minDepthUsd: number;
    minDepthRatio: number;
}

export interface OrchestratorResult {
    executed: boolean;
    reason?: string;
    copySizeUsdc?: number;
    copyShares?: number;
    execPrice?: number;         // Actual execution price (VWAP in sim mode)
    leaderPrice?: number;       // Leader's original price
    slippageBps?: number;       // execPrice vs leaderPrice in BPS
    latencyMs?: number;         // Detection delay vs leader's trade timestamp
    feePaid?: number;           // Taker fee in USDC
    side?: string;
    tokenId?: string;
    txHash?: string;
}

const DEFAULT_SPEED_PROFILE: SpeedProfile = {
    name: "Standard",
    maxSpreadBps: 200,    // Max 2% spread
    depthLevels: 3,       // Look at top 3 levels
    minDepthUsd: 10,      // Minimum $10 depth
    minDepthRatio: 1.5    // Require 1.5x depth vs trade size
};

const MAX_DYNAMIC_DEVIATION = 0.2; // 20% hard cap

// Polymarket taker fee rate (0.1% = 10 bps)
const POLYMARKET_TAKER_FEE_RATE = 0.001;
const CLOB_PUBLIC_API = 'https://clob.polymarket.com';

export class TradeOrchestrator {
    private executionService: CopyTradingExecutionService;
    private tokenMetadataService: TokenMetadataService;
    private tradingService: TradingService;
    private prisma: PrismaClient;
    private speedProfile: SpeedProfile;
    private deferSettlement: boolean;
    private isSimulation: boolean;

    constructor(
        executionService: CopyTradingExecutionService,
        tokenMetadataService: TokenMetadataService,
        tradingService: TradingService,
        prisma: PrismaClient,
        speedProfile: SpeedProfile = DEFAULT_SPEED_PROFILE,
        deferSettlement: boolean = false,
        isSimulation: boolean = false
    ) {
        this.executionService = executionService;
        this.tokenMetadataService = tokenMetadataService;
        this.tradingService = tradingService;
        this.prisma = prisma;
        this.speedProfile = speedProfile;
        this.deferSettlement = deferSettlement;
        this.isSimulation = isSimulation;
    }

    private getLevelSize(level: any): number {
        return Number(level?.size ?? level?.amount ?? level?.quantity ?? 0);
    }

    /**
     * Fetch real public CLOB orderbook (no auth required) and compute VWAP execution price.
     * Used in simulation mode to get an accurate cost estimate for the copy trade.
     * Falls back to leaderPrice if CLOB is unreachable.
     */
    private async getSimulationPrice(params: {
        tokenId: string;
        side: 'BUY' | 'SELL';
        copySizeUsdc: number;
        leaderPrice: number;
    }): Promise<{ execPrice: number; slippageBps: number; fromClob: boolean; fillRatio: number; depthUsdc: number }> {
        const { tokenId, side, copySizeUsdc, leaderPrice } = params;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const resp = await fetch(`${CLOB_PUBLIC_API}/book?token_id=${tokenId}`, {
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!resp.ok) throw new Error(`CLOB HTTP ${resp.status}`);
            const book = await resp.json();

            const levels: Array<{ price: string; size: string }> =
                side === 'BUY' ? (book.asks ?? []) : (book.bids ?? []);

            if (!levels.length) throw new Error('Empty orderbook');

            // Walk levels and compute VWAP up to copySizeUsdc
            let remainingUsdc = copySizeUsdc;
            let totalUsdc = 0;
            let totalShares = 0;
            for (const lvl of levels) {
                const px = Number(lvl.price);
                const sz = Number(lvl.size); // size in shares
                if (px <= 0 || sz <= 0) continue;
                const levelUsdc = sz * px;
                const consumedUsdc = Math.min(levelUsdc, remainingUsdc);
                const consumedShares = consumedUsdc / px;
                totalUsdc += consumedUsdc;
                totalShares += consumedShares;
                remainingUsdc -= consumedUsdc;
                if (remainingUsdc <= 0.001) break;
            }

            if (totalShares <= 0) throw new Error('No tradeable depth');
            const vwap = totalUsdc / totalShares;
            const slippageBps = leaderPrice > 0
                ? Math.round(((vwap - leaderPrice) / leaderPrice) * 10000)
                : 0;

            // Fill ratio: 1.0 = fully filled, <1.0 = insufficient depth for FOK
            const fillRatio = copySizeUsdc > 0 ? Math.min(1.0, totalUsdc / copySizeUsdc) : 1.0;

            return { execPrice: vwap, slippageBps, fromClob: true, fillRatio, depthUsdc: totalUsdc };
        } catch (e: any) {
            // CLOB unavailable — fall back to leader price silently (assume full fill)
            return { execPrice: leaderPrice, slippageBps: 0, fromClob: false, fillRatio: 1.0, depthUsdc: copySizeUsdc };
        }
    }

    private async getOrderbookPrice(tokenId: string, side: 'BUY' | 'SELL') {
        try {
            const orderbook = await this.tradingService.getOrderBook(tokenId);
            if (!orderbook?.asks || !orderbook?.bids || (!orderbook.asks.length && !orderbook.bids.length)) {
                return { orderbook: null, price: 0.5, bestAsk: 0, bestBid: 0 };
            }
            const bestAsk = Number(orderbook.asks[0]?.price || 0);
            const bestBid = Number(orderbook.bids[0]?.price || 0);
            const price = side === 'BUY' ? (bestAsk || bestBid || 0.5) : (bestBid || bestAsk || 0.5);
            return { orderbook, price, bestAsk, bestBid };
        } catch (e) {
            console.warn(`[Orchestrator] Failed to fetch orderbook for ${tokenId}`, e);
            return { orderbook: null, price: 0.5, bestAsk: 0, bestBid: 0 };
        }
    }

    private evaluateOrderbookGuardrails(params: {
        orderbook: any;
        side: 'BUY' | 'SELL';
        notionalUsd: number;
        profile: SpeedProfile;
    }) {
        const { orderbook, side, notionalUsd, profile } = params;
        const bestAsk = Number(orderbook?.asks?.[0]?.price || 0);
        const bestBid = Number(orderbook?.bids?.[0]?.price || 0);

        if (bestAsk <= 0 || bestBid <= 0) {
            return { allowed: false, reason: 'ORDERBOOK_EMPTY', bestAsk, bestBid };
        }

        const mid = (bestAsk + bestBid) / 2;
        const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10000 : 0;
        if (profile.maxSpreadBps > 0 && spreadBps > profile.maxSpreadBps) {
            return { allowed: false, reason: `SPREAD_${spreadBps.toFixed(1)}BPS`, spreadBps, bestAsk, bestBid };
        }

        const levels = side === 'BUY' ? orderbook.asks : orderbook.bids;
        const maxLevels = profile.depthLevels;
        const requiredShares = bestAsk > 0 ? notionalUsd / (side === 'BUY' ? bestAsk : bestBid) : 0;
        let depthShares = 0;
        for (let i = 0; i < Math.min(levels.length, maxLevels); i++) {
            depthShares += this.getLevelSize(levels[i]);
            if (requiredShares > 0 && depthShares >= requiredShares * profile.minDepthRatio) break;
        }
        const depthUsd = depthShares * (side === 'BUY' ? bestAsk : bestBid);

        if (profile.minDepthUsd > 0 && depthUsd < profile.minDepthUsd) {
            return { allowed: false, reason: `DEPTH_USD_${depthUsd.toFixed(2)}`, depthUsd, depthShares, bestAsk, bestBid };
        }

        if (requiredShares > 0 && depthShares < requiredShares * profile.minDepthRatio) {
            return { allowed: false, reason: `DEPTH_RATIO_${depthShares.toFixed(2)}`, depthUsd, depthShares, bestAsk, bestBid };
        }

        return { allowed: true, spreadBps, depthUsd, depthShares, bestAsk, bestBid };
    }

    private getDynamicMaxDeviation(params: {
        baseMaxDeviation: number;
        depthUsd?: number;
    }) {
        const { baseMaxDeviation, depthUsd = 0 } = params;
        if (baseMaxDeviation <= 0) {
            return { maxDeviation: 0, tier: 'disabled', multiplier: 0 };
        }

        let multiplier = 1;
        let tier = 'deep';
        if (depthUsd >= 1000) {
            multiplier = 1;
            tier = 'deep';
        } else if (depthUsd >= 200) {
            multiplier = 1.5;
            tier = 'mid';
        } else if (depthUsd >= 50) {
            multiplier = 2;
            tier = 'shallow';
        } else {
            multiplier = 3;
            tier = 'thin';
        }

        const maxDeviation = Math.min(baseMaxDeviation * multiplier, MAX_DYNAMIC_DEVIATION);
        return { maxDeviation, tier, multiplier };
    }

    private calculateCopySize(config: any, originalSize: number, originalPrice: number): number {
        const originalValue = originalSize * originalPrice;

        if (config.mode === 'FIXED_AMOUNT' && config.fixedAmount) {
            return Math.min(config.fixedAmount, config.maxSizePerTrade);
        }

        // PROPORTIONAL
        const scaledValue = originalValue * (config.sizeScale || 1);
        const minSize = config.minSizePerTrade ?? 0;
        return Math.max(minSize, Math.min(scaledValue, config.maxSizePerTrade));
    }

    private buildOriginalSignalId(txHash: string | null, tokenId: string, side: string, timestamp: number | string): string {
        if (txHash) {
            return `${txHash.toLowerCase()}:${tokenId}:${side}`;
        }
        const ts = Number.isFinite(Number(timestamp)) ? Math.floor(Number(timestamp)) : 0;
        return `local:${tokenId}:${side}:${ts}`;
    }

    private async logSkippedTrade(data: any, reason: string) {
        const payload = {
            ...data,
            status: 'SKIPPED',
            errorMessage: reason,
        };
        const compositeKey = data?.configId && data?.originalTxHash
            ? { configId: data.configId, originalTxHash: data.originalTxHash }
            : null;
        try {
            if (compositeKey) {
                const existing = await this.prisma.copyTrade.findUnique({
                    where: { configId_originalTxHash: compositeKey },
                    select: { status: true },
                });
                if (existing) {
                    if (existing.status === 'SKIPPED') {
                        await this.prisma.copyTrade.update({
                            where: { configId_originalTxHash: compositeKey },
                            data: { errorMessage: reason },
                        });
                    }
                    return;
                }
            }
            await this.prisma.copyTrade.create({ data: payload });
        } catch (e: any) {
            if (e?.code === 'P2002') return;
            console.log(`[Orchestrator] Failed to log SKIPPED trade:`, e);
        }
    }

    private getStrategyOverrides(profile: string) {
        if (profile === 'AGGRESSIVE') {
            return { gasPriority: 'instant', description: 'Aggressive' };
        } else if (profile === 'CONSERVATIVE') {
            return { gasPriority: 'standard', description: 'Conservative' };
        }
        return { gasPriority: 'fast', description: 'Moderate' };
    }

    /**
     * The unified execution pipeline.
     */
    async evaluateAndExecuteTrade(trade: Activity, config: any, eoaTradingService?: TradingService): Promise<OrchestratorResult> {
        const traderAddress = trade.name || '';
        const tokenId = trade.asset;
        const leaderPrice = trade.price;
        const rawSize = trade.size;
        const side = trade.side;
        const txHash = trade.transactionHash;

        // Use standard Polymarket value convention (Size * Price = Value in USDC)
        const tradeShares = rawSize;
        const tradeNotional = tradeShares * leaderPrice;

        // 1. Basic Filters
        if (config.sideFilter && config.sideFilter !== side) return { executed: false, reason: 'SIDE_FILTER' };
        if (config.minTriggerSize && tradeNotional < config.minTriggerSize) return { executed: false, reason: 'MIN_TRIGGER_SIZE' };

        // 2. Max Loss Protection (Stop Loss)
        if (config.stopLoss && config.stopLoss > 0) {
            const stats = await this.prisma.copyTrade.aggregate({
                where: { configId: config.id, realizedPnL: { not: null } },
                _sum: { realizedPnL: true }
            });
            const totalPnL = stats._sum.realizedPnL || 0;
            if (totalPnL < -Math.abs(config.stopLoss)) {
                console.warn(`[Orchestrator] 🛑 Max Loss Hit for ${config.walletAddress}: PnL $${totalPnL.toFixed(2)} vs Limit -$${config.stopLoss}`);
                await this.prisma.copyTradingConfig.update({
                    where: { id: config.id },
                    data: { isActive: false }
                });
                return { executed: false, reason: 'STOP_LOSS_HIT' };
            }
        }

        // 3. Max Odds Check
        if (config.maxOdds && config.maxOdds > 0) {
            const limit = config.maxOdds > 1 ? config.maxOdds / 100 : config.maxOdds;
            if (leaderPrice > limit) {
                await this.logSkippedTrade({
                    configId: config.id,
                    originalTrader: traderAddress,
                    originalSide: side,
                    originalSize: tradeShares,
                    originalPrice: leaderPrice,
                    tokenId: tokenId,
                    copySize: 0,
                    copyPrice: leaderPrice,
                    originalTxHash: this.buildOriginalSignalId(txHash, tokenId, side, trade.timestamp),
                    detectedAt: new Date(),
                    marketSlug: trade.slug,
                    conditionId: trade.conditionId,
                    outcome: trade.outcome
                }, `ODDS_TOO_HIGH_${leaderPrice.toFixed(2)}`);
                return { executed: false, reason: 'MAX_ODDS_EXCEEDED' };
            }
        }

        // 4. COUNTER Logic
        let copySide = side;
        if (config.direction === 'COUNTER') {
            copySide = side === 'BUY' ? 'SELL' : 'BUY';
        }

        let copySizeUsdc = this.calculateCopySize(config, tradeShares, leaderPrice);
        if (copySizeUsdc <= 0) return { executed: false, reason: 'INVALID_COPY_SIZE' };

        const strategy = this.getStrategyOverrides(config.strategyProfile);
        let overrides = {};
        if (strategy.gasPriority === 'fast') {
            overrides = { maxPriorityFeePerGas: 40000000000 };
        } else if (strategy.gasPriority === 'instant') {
            overrides = { maxPriorityFeePerGas: 100000000000 };
        }

        // 5. Metadata Enrichment
        let fetched = await this.tokenMetadataService.getMetadata(tokenId);
        let metadata: any = {
            marketSlug: trade.slug || '',
            conditionId: trade.conditionId || '',
            outcome: trade.outcome || 'Yes'
        };
        if (fetched) {
            metadata = { ...metadata, ...fetched };
        }

        // 6. Orderbook Guardrails
        // In simulation mode: skip real CLOB fetch (avoids API-key 400 spam) and use the
        // leader's actual execution price — that's the ground truth for copy-trading simulation.
        let orderbookSnapshot: Awaited<ReturnType<typeof this.getOrderbookPrice>>;
        if (this.isSimulation) {
            // Build a synthetic orderbook at the leader's price so guardrails always pass
            const syntheticBook = {
                hash: 'sim',
                asks: [{ price: String(leaderPrice), size: String(copySizeUsdc * 10) }],
                bids: [{ price: String(leaderPrice), size: String(copySizeUsdc * 10) }],
            };
            orderbookSnapshot = { orderbook: syntheticBook, price: leaderPrice, bestAsk: leaderPrice, bestBid: leaderPrice };
        } else {
            orderbookSnapshot = await this.getOrderbookPrice(tokenId, copySide as 'BUY' | 'SELL');
        }
        let marketPrice = orderbookSnapshot.price;

        if (!orderbookSnapshot.orderbook) {
            await this.logSkippedTrade({
                configId: config.id,
                originalTrader: traderAddress,
                originalSide: copySide,
                originalSize: tradeShares,
                originalPrice: leaderPrice,
                tokenId: tokenId,
                copySize: copySizeUsdc,
                copyPrice: marketPrice,
                originalTxHash: this.buildOriginalSignalId(txHash, tokenId, copySide, trade.timestamp),
                detectedAt: new Date(),
                marketSlug: metadata.marketSlug,
                conditionId: metadata.conditionId,
                outcome: metadata.outcome
            }, 'ORDERBOOK_UNAVAILABLE');
            return { executed: false, reason: 'ORDERBOOK_UNAVAILABLE' };
        }

        if (config.minLiquidity && config.minLiquidity > 0) {
            const book = orderbookSnapshot.orderbook;
            const relevantSide = (copySide === 'BUY' ? book.asks : book.bids) || [];
            let totalLiq = 0;
            for (let i = 0; i < Math.min(relevantSide.length, 20); i++) {
                const level = relevantSide[i];
                const sz = this.getLevelSize(level);
                const px = Number(level.price);
                totalLiq += (sz * px);
            }

            if (totalLiq < config.minLiquidity) {
                await this.logSkippedTrade({
                    configId: config.id,
                    originalTrader: traderAddress,
                    originalSide: copySide,
                    originalSize: tradeShares,
                    originalPrice: leaderPrice,
                    tokenId: tokenId,
                    copySize: copySizeUsdc,
                    copyPrice: marketPrice,
                    originalTxHash: this.buildOriginalSignalId(txHash, tokenId, copySide, trade.timestamp),
                    detectedAt: new Date(),
                    marketSlug: metadata.marketSlug,
                    conditionId: metadata.conditionId,
                    outcome: metadata.outcome
                }, `LOW_LIQUIDITY_$${totalLiq.toFixed(0)}`);
                return { executed: false, reason: 'LOW_LIQUIDITY' };
            }
        }

        let orderbookGuard = this.evaluateOrderbookGuardrails({
            orderbook: orderbookSnapshot.orderbook,
            side: copySide as 'BUY' | 'SELL',
            notionalUsd: copySizeUsdc,
            profile: this.speedProfile,
        });

        if (!orderbookGuard.allowed && orderbookGuard.reason?.startsWith('DEPTH_')) {
            const safeDepthUsd = (orderbookGuard.depthUsd || 0) * 0.95;
            if (safeDepthUsd >= this.speedProfile.minDepthUsd && copySizeUsdc > safeDepthUsd) {
                console.warn(`[Orchestrator] ⚠️ Orderbook depth low. Scaling down ${copySide} from $${copySizeUsdc.toFixed(2)} to $${safeDepthUsd.toFixed(2)}`);
                copySizeUsdc = safeDepthUsd;
                orderbookGuard = this.evaluateOrderbookGuardrails({
                    orderbook: orderbookSnapshot.orderbook,
                    side: copySide as 'BUY' | 'SELL',
                    notionalUsd: copySizeUsdc,
                    profile: this.speedProfile,
                });
            }
        }

        if (!orderbookGuard.allowed) {
            console.warn(`[Orchestrator] 🛑 Guardrail skipped: ${orderbookGuard.reason}`);
            await this.logSkippedTrade({
                configId: config.id,
                originalTrader: traderAddress,
                originalSide: copySide,
                originalSize: tradeShares,
                originalPrice: leaderPrice,
                tokenId: tokenId,
                copySize: copySizeUsdc,
                copyPrice: marketPrice,
                originalTxHash: this.buildOriginalSignalId(txHash, tokenId, copySide, trade.timestamp),
                detectedAt: new Date(),
                marketSlug: metadata.marketSlug,
                conditionId: metadata.conditionId,
                outcome: metadata.outcome
            }, `ORDERBOOK_${orderbookGuard.reason}`);
            return { executed: false, reason: `ORDERBOOK_${orderbookGuard.reason}` };
        }

        const baseMaxDeviation = (config.maxSlippage ?? 0) / 100;
        const dynamicMax = this.getDynamicMaxDeviation({
            baseMaxDeviation,
            depthUsd: orderbookGuard.depthUsd,
        });
        const maxDeviation = dynamicMax.maxDeviation;

        let useLimitFallback = false;
        let limitPrice = marketPrice;

        if (leaderPrice > 0 && maxDeviation > 0) {
            const deviation = Math.abs(marketPrice - leaderPrice) / leaderPrice;
            if (deviation > maxDeviation) {
                limitPrice = copySide === 'BUY'
                    ? leaderPrice * (1 + maxDeviation)
                    : leaderPrice * (1 - maxDeviation);
                useLimitFallback = true;
            } else {
                const maxExecPrice = leaderPrice * (1 + maxDeviation);
                if (copySide === 'BUY' && marketPrice > maxExecPrice) {
                    await this.logSkippedTrade({
                        configId: config.id,
                        originalTrader: traderAddress,
                        originalSide: copySide,
                        originalSize: tradeShares,
                        originalPrice: leaderPrice,
                        tokenId: tokenId,
                        copySize: copySizeUsdc,
                        copyPrice: marketPrice,
                        originalTxHash: this.buildOriginalSignalId(txHash, tokenId, copySide, trade.timestamp),
                        detectedAt: new Date(),
                        marketSlug: metadata.marketSlug,
                        conditionId: metadata.conditionId,
                        outcome: metadata.outcome
                    }, `EXCEEDS_MAX_SLIPPAGE`);
                    return { executed: false, reason: 'EXCEEDS_MAX_SLIPPAGE' };
                }
            }
        }

        // 7. SELL Guard — only applies when we are actually executing a SELL
        if (copySide === 'SELL') {
            // If configured to never sell, silently skip before even checking positions
            if (config.sellMode === 'NO_SELL') {
                return { executed: false, reason: 'NO_SELL_CONFIGURED' };
            }

            const positions = await this.prisma.userPosition.findMany({
                where: { walletAddress: config.walletAddress.toLowerCase(), tokenId: tokenId, balance: { gt: 0 } }
            });

            if (positions.length === 0) {
                await this.logSkippedTrade({
                    configId: config.id,
                    originalTrader: traderAddress,
                    originalSide: copySide,
                    originalSize: tradeShares,
                    originalPrice: leaderPrice,
                    tokenId: tokenId,
                    copySize: copySizeUsdc,
                    copyPrice: marketPrice,
                    originalTxHash: this.buildOriginalSignalId(txHash, tokenId, copySide, trade.timestamp),
                    detectedAt: new Date(),
                    marketSlug: metadata.marketSlug,
                    conditionId: metadata.conditionId,
                    outcome: metadata.outcome
                }, `NO_CURRENT_POSITION`);
                return { executed: false, reason: 'NO_CURRENT_POSITION' };
            }

            if (config.sellMode === 'CLOSE_ALL') {
                const totalShares = positions.reduce((acc, p) => acc + p.balance, 0);
                copySizeUsdc = totalShares * marketPrice;
            }
        }

        // 8. Log the PENDING trade
        // Use upsert-style pattern: try create, on P2002 (race between CTF listener + WebSocket)
        // fetch the existing record and reuse it to avoid duplicate execution.
        const originalTxHash = this.buildOriginalSignalId(txHash, tokenId, copySide, trade.timestamp);
        let copyTrade: any;
        try {
            copyTrade = await this.prisma.copyTrade.create({
                data: {
                    configId: config.id,
                    originalTrader: traderAddress,
                    originalSide: copySide,
                    leaderSide: side !== copySide ? side : undefined,
                    originalSize: tradeShares,
                    originalPrice: leaderPrice,
                    marketSlug: metadata.marketSlug,
                    conditionId: metadata.conditionId,
                    tokenId: tokenId,
                    outcome: metadata.outcome,
                    copySize: copySizeUsdc,
                    copyPrice: marketPrice,
                    originalTxHash,
                    detectedAt: new Date()
                }
            });
        } catch (e: any) {
            if (e?.code === 'P2002') {
                // Duplicate: another event source already inserted this trade — skip silently.
                return { executed: false, reason: 'DUPLICATE_TX_HASH' };
            }
            throw e;
        }

        console.log(`[Orchestrator] 🚀 Dispatching Execution -> Tx: ${copyTrade.id}`);

        // 9. Execute On-Chain
        let result: {
            success: boolean;
            orderId?: string;
            error?: string;
            usedBotFloat?: boolean;
            transactionHashes?: string[];
            executedAmount?: number;
            scaledDown?: boolean;
            tokenPushTxHash?: string;
            returnTransferTxHash?: string;
            settlementDeferred?: boolean;
            filledShares?: number;
            actualSellProceedsUsdc?: number;
            sellProceedsSource?: 'trade_ids' | 'order_snapshot' | 'fallback' | 'none';
        } = { success: false };
        let execPrice = marketPrice;
        let simSlippageBps = 0;
        let simLatencyMs = 0;
        let simFeePaid = 0;

        if (this.isSimulation) {
            console.log(`[Orchestrator] 🧪 Simulation Mode: Bypassing on-chain execution for ${copyTrade.id}`);
            // Default simulation accounting to the leader's observed execution price.
            // Set SIM_USE_CLOB_VWAP=true only when you explicitly want CLOB VWAP-based fills.
            const useClobVwapForSimulation = process.env.SIM_USE_CLOB_VWAP === 'true';

            // --- Step 2: FOK Scale-Down Simulation ---
            // Real Polymarket uses Fill-Or-Kill. We simulate the same scale-down logic
            // as real execution: try 100%, then 75%, then 50% for SELLs (or if allowed).
            let simulateScale = 1.0;
            const simScaleFactors = (copySide === 'SELL' || config.allowPartialFill) ? [1.0, 0.75, 0.5] : [1.0];
            let simPrice = await this.getSimulationPrice({
                tokenId,
                side: copySide as 'BUY' | 'SELL',
                copySizeUsdc,
                leaderPrice,
            });

            let simSuccess = false;
            for (const scale of simScaleFactors) {
                simulateScale = scale;
                const attemptUsdc = copySizeUsdc * scale;

                simPrice = await this.getSimulationPrice({
                    tokenId,
                    side: copySide as 'BUY' | 'SELL',
                    copySizeUsdc: attemptUsdc, // use scaled amount for depth check
                    leaderPrice,
                });

                if (!simPrice.fromClob || simPrice.fillRatio >= 0.95) {
                    simSuccess = true;
                    if (scale < 1.0) {
                        console.log(`[Orchestrator] ⚠️ SIM_FOK_SCALED_DOWN: executed ${copySide} at ${(scale * 100).toFixed(0)}% scale -> $${attemptUsdc.toFixed(2)}`);
                    }
                    break;
                } else {
                    console.log(`[Orchestrator] ❌ SIM_FOK_REJECTED at ${(scale * 100).toFixed(0)}% scale: depth $${simPrice.depthUsdc.toFixed(2)} < order $${attemptUsdc.toFixed(2)} (fill: ${(simPrice.fillRatio * 100).toFixed(0)}%)`);
                }
            }

            if (!simSuccess) {
                // Update DB record to FAILED
                await this.prisma.copyTrade.update({
                    where: { id: copyTrade.id },
                    data: { status: 'FAILED' as any, errorMessage: `SIM_FOK_REJECTED_ALL_SCALES (final fill ${(simPrice.fillRatio * 100).toFixed(0)}%)` }
                });
                return { executed: false, reason: 'SIM_FOK_REJECTED' };
            }

            // Adjust the actual copy size if we scaled down
            if (simulateScale < 1.0) {
                copySizeUsdc = copySizeUsdc * simulateScale;
                result.scaledDown = true;
            }

            const safeLeaderPrice = leaderPrice > 0 ? leaderPrice : simPrice.execPrice;
            execPrice = useClobVwapForSimulation ? simPrice.execPrice : safeLeaderPrice;
            simSlippageBps = useClobVwapForSimulation ? simPrice.slippageBps : 0;

            // --- Step 3: Execution Delay Simulation ---
            // Real chain submission takes 1-4 seconds. During this time, the price may drift.
            const execDelayMs = 1000 + Math.random() * 3000; // 1-4 seconds

            // --- Step 4: Post-Delay FOK Check ---
            // In real trading, you submit a LIMIT order at ~initialVWAP + slippage tolerance.
            // If the market moves beyond your tolerance during the 1-4s submission window,
            // the order is REJECTED (FOK failure) — you do NOT get filled at the drifted price.
            // The execution price remains the initial VWAP (the price your order was submitted at).
            const postDelayPrice = await this.getSimulationPrice({
                tokenId,
                side: copySide as 'BUY' | 'SELL',
                copySizeUsdc,
                leaderPrice,
            });

            if (postDelayPrice.fromClob) {
                // Post-delay depth check: depth may have decreased during delay
                // Even if we scaled down initially, check if the scaled amount can still be filled
                if (postDelayPrice.fillRatio < 0.95) {
                    console.log(`[Orchestrator] ❌ SIM_FOK_REJECTED (post-delay depth): fill ${(postDelayPrice.fillRatio * 100).toFixed(0)}%`);
                    await this.prisma.copyTrade.update({
                        where: { id: copyTrade.id },
                        data: { status: 'FAILED' as any, errorMessage: `SIM_FOK_REJECTED_POST_DELAY (fill ${(postDelayPrice.fillRatio * 100).toFixed(0)}%)` }
                    });
                    return { executed: false, reason: 'SIM_FOK_REJECTED' };
                }

                if (useClobVwapForSimulation) {
                    // Check if price drifted beyond slippage tolerance
                    const slippageTolerance = (config.maxSlippage ?? 2.0) / 100; // e.g. 2% → 0.02
                    const priceDrift = Math.abs(postDelayPrice.execPrice - execPrice) / execPrice;

                    if (priceDrift > slippageTolerance) {
                        console.log(`[Orchestrator] ❌ SIM_FOK_REJECTED (price drift ${(priceDrift * 100).toFixed(1)}% > ${(slippageTolerance * 100).toFixed(1)}% tolerance): $${execPrice.toFixed(4)} → $${postDelayPrice.execPrice.toFixed(4)}`);
                        await this.prisma.copyTrade.update({
                            where: { id: copyTrade.id },
                            data: { status: 'FAILED' as any, errorMessage: `SIM_PRICE_DRIFT_${(priceDrift * 100).toFixed(0)}PCT` }
                        });
                        return { executed: false, reason: 'SIM_FOK_REJECTED' };
                    }

                    // Within tolerance: apply a small realistic price impact (half of drift)
                    // since some movement is expected but you wouldn't get the full adverse move
                    if (copySide === 'BUY' && postDelayPrice.execPrice > execPrice) {
                        execPrice += (postDelayPrice.execPrice - execPrice) * 0.3; // 30% of adverse move
                    } else if (copySide === 'SELL' && postDelayPrice.execPrice < execPrice) {
                        execPrice -= (execPrice - postDelayPrice.execPrice) * 0.3;
                    }
                }
            }

            // Taker fee: 0.1% of collateral spent
            simFeePaid = copySizeUsdc * POLYMARKET_TAKER_FEE_RATE;

            // Total simulated latency: detection + execution delay
            if (trade.timestamp) {
                const leaderTs = trade.timestamp > 1e10  // ms vs s
                    ? trade.timestamp
                    : trade.timestamp * 1000;
                simLatencyMs = Math.max(0, Date.now() - leaderTs) + execDelayMs;
            } else {
                simLatencyMs = execDelayMs;
            }

            result = {
                success: true,
                transactionHashes: [`sim-${Date.now()}`],
                usedBotFloat: false
            };
        } else if (config.executionMode === 'EOA' && eoaTradingService) {
            const fixedSlippage = config.slippageType === 'FIXED' ? (config.maxSlippage / 100) : 0;
            const execPrice = copySide === 'BUY'
                ? marketPrice * (1 + fixedSlippage)
                : marketPrice * (1 - fixedSlippage);
            const orderAmount = copySide === 'BUY'
                ? copySizeUsdc
                : (execPrice > 0 ? copySizeUsdc / execPrice : 0);

            const orderResult = await eoaTradingService.createMarketOrder({
                tokenId,
                side: copySide as 'BUY' | 'SELL',
                amount: orderAmount,
                price: execPrice,
                orderType: 'FOK',
            });

            result = {
                success: orderResult.success,
                orderId: orderResult.orderId,
                error: orderResult.errorMsg,
                settlementDeferred: false,
            };
        } else {
            const proxyResult = await this.executionService.executeOrderWithProxy({
                tradeId: copyTrade.id,
                walletAddress: config.walletAddress.toLowerCase(),
                side: copySide as 'BUY' | 'SELL',
                tokenId: tokenId,
                amount: copySizeUsdc,
                price: useLimitFallback ? limitPrice : marketPrice,
                slippage: maxDeviation,
                slippageMode: 'AUTO',
                overrides: overrides,
                deferReimbursement: false,
                deferSettlement: this.deferSettlement,
                allowPartialFill: true // Enable robust FOK scaling
            });
            result = proxyResult as any;

            // Update real amount if scaled down
            if (result.success && result.executedAmount) {
                // If the execution returned a scaled-down amount, use that as the copySize Usdc
                if (result.scaledDown) {
                    copySizeUsdc = result.executedAmount;
                }
            }

            // SELL accounting should use actual fill notional when available.
            if (result.success && copySide === 'SELL' && result.actualSellProceedsUsdc && result.actualSellProceedsUsdc > 0) {
                copySizeUsdc = result.actualSellProceedsUsdc;
                if (result.filledShares && result.filledShares > 0) {
                    execPrice = result.actualSellProceedsUsdc / result.filledShares;
                }
            }
        }

        // 10. Process Update
        let finalStatus = 'EXECUTED';
        let errorMessage = null;

        if (!result.success) {
            finalStatus = 'FAILED';
            errorMessage = result.error || 'Execution failed';
        } else {
            const isProxyMode = !this.isSimulation && config.executionMode !== 'EOA';
            if (isProxyMode) {
                const settlementDeferred = Boolean(result.settlementDeferred);
                const settlementConfirmed = copySide === 'BUY'
                    ? Boolean(result.tokenPushTxHash)
                    : Boolean(result.returnTransferTxHash);
                if (settlementDeferred || !settlementConfirmed) {
                    finalStatus = 'SETTLEMENT_PENDING';
                    errorMessage = 'Settlement Pending';
                }
            }
        }

        await this.prisma.copyTrade.update({
            where: { id: copyTrade.id },
            data: {
                status: finalStatus as any,
                executedAt: new Date(),
                txHash: result.transactionHashes?.[0] || result.orderId || undefined,
                errorMessage: errorMessage,
                usedBotFloat: result.usedBotFloat,
                copySize: copySizeUsdc, // Ensure DB accurately reflects the possibly scaled-down size
                copyPrice: execPrice
            }
        });

        if (result.success && result.transactionHashes && result.transactionHashes.length > 0) {
            console.log(`[Orchestrator] ✅ Trade Executed: ${result.transactionHashes[0]}`);

            // DB Record position — BUY 按 USDC/价格折算 shares；SELL 优先使用成交回执里的 filledShares。
            const resolvedBuyShares = execPrice > 0 ? (copySizeUsdc / execPrice) : 0;
            const resolvedSellShares = (copySide === 'SELL' && result.filledShares && result.filledShares > 0)
                ? result.filledShares
                : (execPrice > 0 ? (copySizeUsdc / execPrice) : 0);
            const shares = copySide === 'BUY' ? resolvedBuyShares : -resolvedSellShares;
            const totalCostInsert = copySide === 'BUY' ? copySizeUsdc : 0;
            await this.prisma.$executeRaw`
                INSERT INTO "UserPosition" ("id", "walletAddress", "tokenId", "balance", "totalCost", "avgEntryPrice", "updatedAt")
                VALUES (gen_random_uuid(), ${config.walletAddress.toLowerCase()}, ${tokenId}, ${shares}, ${totalCostInsert}, ${execPrice}, CURRENT_TIMESTAMP)
                ON CONFLICT ("walletAddress", "tokenId") 
                DO UPDATE SET 
                    "balance" = GREATEST("UserPosition"."balance" + EXCLUDED."balance", 0),
                    "totalCost" = "UserPosition"."totalCost" + EXCLUDED."totalCost",
                    "avgEntryPrice" = CASE WHEN ("UserPosition"."balance" + EXCLUDED."balance") > 0 THEN ("UserPosition"."totalCost" + EXCLUDED."totalCost") / ("UserPosition"."balance" + EXCLUDED."balance") ELSE 0 END,
                    "updatedAt" = CURRENT_TIMESTAMP
            `;

            return {
                executed: true,
                copySizeUsdc,
                copyShares: Math.abs(shares),
                execPrice,
                leaderPrice,
                slippageBps: simSlippageBps,
                latencyMs: simLatencyMs,
                feePaid: simFeePaid,
                side: copySide,
                tokenId: tokenId,
                txHash: result.transactionHashes[0] || result.orderId
            };
        }

        return {
            executed: false,
            reason: errorMessage || 'UNKNOWN_FAILURE'
        };
    }
}
