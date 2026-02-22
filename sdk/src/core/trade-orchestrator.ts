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
    execPrice?: number;
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

        // 7.SELL Guard
        if (copySide === 'SELL' || config.sellMode === 'NO_SELL') {
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

            if (config.sellMode === 'NO_SELL') {
                return { executed: false, reason: 'NO_SELL_CONFIGURED' }; // Silently skip
            } else if (config.sellMode === 'CLOSE_ALL') {
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
        let result: { success: boolean; orderId?: string; error?: string; usedBotFloat?: boolean; transactionHashes?: string[] } = { success: false };

        if (this.isSimulation) {
            console.log(`[Orchestrator] 🧪 Simulation Mode: Bypassing on-chain execution for ${copyTrade.id}`);
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
                deferSettlement: this.deferSettlement
            });
            result = proxyResult as any;
        }

        // 10. Process Update
        let finalStatus = 'EXECUTED';
        let errorMessage = null;

        if (!result.success) {
            finalStatus = 'FAILED';
            errorMessage = result.error || 'Execution failed';
        }

        await this.prisma.copyTrade.update({
            where: { id: copyTrade.id },
            data: {
                status: finalStatus as any,
                executedAt: new Date(),
                txHash: result.transactionHashes?.[0] || undefined,
                errorMessage: errorMessage,
                usedBotFloat: result.usedBotFloat
            }
        });

        if (result.success && result.transactionHashes && result.transactionHashes.length > 0) {
            console.log(`[Orchestrator] ✅ Trade Executed: ${result.transactionHashes[0]}`);

            // DB Record position
            const shares = copySide === 'BUY' ? copySizeUsdc / marketPrice : -(copySizeUsdc / marketPrice);
            await this.prisma.$executeRaw`
                INSERT INTO "UserPosition" ("id", "walletAddress", "tokenId", "balance", "totalCost", "avgEntryPrice", "updatedAt")
                VALUES (gen_random_uuid(), ${config.walletAddress.toLowerCase()}, ${tokenId}, ${shares}, ${side === 'BUY' ? copySizeUsdc : 0}, ${marketPrice}, CURRENT_TIMESTAMP)
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
                execPrice: marketPrice,
                side: copySide,
                tokenId: tokenId,
                txHash: result.transactionHashes[0]
            };
        }

        return {
            executed: false,
            reason: errorMessage || 'UNKNOWN_FAILURE'
        };
    }
}
