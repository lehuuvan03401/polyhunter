import { prisma, isDatabaseEnabled } from '@/lib/prisma';

// Configuration from environment
const ENABLE_REAL_TRADING = process.env.ENABLE_REAL_TRADING === 'true';
const EMERGENCY_PAUSE = process.env.COPY_TRADING_EMERGENCY_PAUSE === 'true';
const DRY_RUN = process.env.COPY_TRADING_DRY_RUN === 'true';
const GLOBAL_DAILY_CAP_USD = Number(process.env.COPY_TRADING_DAILY_CAP_USD || '0');
const WALLET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_WALLET_DAILY_CAP_USD || '0');
const MARKET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_MARKET_DAILY_CAP_USD || '0');
const MAX_TRADES_PER_WINDOW = Number(process.env.COPY_TRADING_MAX_TRADES_PER_WINDOW || '0');
const TRADE_WINDOW_MS = Number(process.env.COPY_TRADING_TRADE_WINDOW_MS || '600000');
const EXECUTION_ALLOWLIST = (process.env.COPY_TRADING_EXECUTION_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const WORKER_ALLOWLIST = (process.env.COPY_TRADING_WORKER_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const MAX_TRADE_USD = Number(process.env.COPY_TRADING_MAX_TRADE_USD || '0');
const GUARDRAIL_LOG_INTERVAL_MS = Number(process.env.COPY_TRADING_GUARDRAIL_LOG_INTERVAL_MS || '60000');
const GUARDRAIL_ALERT_THRESHOLD = Number(process.env.COPY_TRADING_GUARDRAIL_ALERT_THRESHOLD || '20');
const MARKET_CAPS_RAW = process.env.COPY_TRADING_MARKET_CAPS || '';

const MARKET_CAPS = new Map<string, number>();
if (MARKET_CAPS_RAW) {
    MARKET_CAPS_RAW.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
            const [slug, cap] = entry.split(/[:=]/).map((part) => part.trim());
            const capValue = Number(cap);
            if (slug && Number.isFinite(capValue) && capValue > 0) {
                MARKET_CAPS.set(slug.toLowerCase(), capValue);
            }
        });
}

type GuardrailStatState = {
    total: number;
    byReason: Map<string, number>;
    bySource: Map<string, number>;
    lastLogAt: number;
    lastAlertAt: number;
};

const guardrailStats: GuardrailStatState = {
    total: 0,
    byReason: new Map(),
    bySource: new Map(),
    lastLogAt: Date.now(),
    lastAlertAt: 0,
};

export interface GuardrailResult {
    allowed: boolean;
    reason?: string;
}

export interface GuardrailContext {
    workerAddress?: string;
    marketSlug?: string;
    tradeId?: string;
    tokenId?: string;
    source?: string;
}

export class GuardrailService {
    static recordGuardrailTrigger(params: {
        reason: string;
        source: string;
        walletAddress?: string;
        amount?: number;
        tradeId?: string;
        tokenId?: string;
    }) {
        guardrailStats.total += 1;
        guardrailStats.byReason.set(params.reason, (guardrailStats.byReason.get(params.reason) || 0) + 1);
        guardrailStats.bySource.set(params.source, (guardrailStats.bySource.get(params.source) || 0) + 1);

        const now = Date.now();
        if (GUARDRAIL_ALERT_THRESHOLD > 0 && guardrailStats.total >= GUARDRAIL_ALERT_THRESHOLD && now - guardrailStats.lastAlertAt > GUARDRAIL_LOG_INTERVAL_MS) {
            guardrailStats.lastAlertAt = now;
            console.warn(`[Guardrail] ⚠️ High trigger volume: ${guardrailStats.total} hits in last ${(GUARDRAIL_LOG_INTERVAL_MS / 1000).toFixed(0)}s`);
        }

        if (now - guardrailStats.lastLogAt >= GUARDRAIL_LOG_INTERVAL_MS) {
            const reasonSummary = Array.from(guardrailStats.byReason.entries())
                .map(([reason, count]) => `${reason}:${count}`)
                .join(', ');
            const sourceSummary = Array.from(guardrailStats.bySource.entries())
                .map(([source, count]) => `${source}:${count}`)
                .join(', ');

            console.log(
                `[Guardrail] Summary last ${(GUARDRAIL_LOG_INTERVAL_MS / 1000).toFixed(0)}s | total=${guardrailStats.total} | reasons=[${reasonSummary}] | sources=[${sourceSummary}]`
            );

            guardrailStats.total = 0;
            guardrailStats.byReason.clear();
            guardrailStats.bySource.clear();
            guardrailStats.lastLogAt = now;
        }

        if (isDatabaseEnabled && typeof (prisma as any).guardrailEvent !== 'undefined') {
            void prisma.guardrailEvent.create({
                data: {
                    reason: params.reason,
                    source: params.source,
                    walletAddress: params.walletAddress,
                    amount: params.amount,
                    tradeId: params.tradeId,
                    tokenId: params.tokenId,
                },
            }).catch((error) => {
                console.warn('[Guardrail] Failed to persist guardrail event:', error);
            });
        }
    }
    /**
     * Calculate total executed volume (in USD) since a given date.
     */
    static async getExecutedTotalSince(since: Date, walletAddress?: string): Promise<number> {
        const where: any = {
            status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
            executedAt: { gte: since },
        };

        if (walletAddress) {
            where.config = { walletAddress: walletAddress.toLowerCase() };
        }

        const result = await prisma.copyTrade.aggregate({
            _sum: { copySize: true },
            where,
        });

        return Number(result?._sum?.copySize || 0);
    }

    /**
     * Calculate total executed volume for a market since a given date.
     */
    static async getExecutedTotalForMarketSince(since: Date, marketSlug: string): Promise<number> {
        const result = await prisma.copyTrade.aggregate({
            _sum: { copySize: true },
            where: {
                status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
                executedAt: { gte: since },
                marketSlug,
            },
        });

        return Number(result?._sum?.copySize || 0);
    }

    /**
     * Count executed trades since a given date.
     */
    static async getExecutedCountSince(since: Date): Promise<number> {
        return prisma.copyTrade.count({
            where: {
                status: { in: ['EXECUTED', 'SETTLEMENT_PENDING'] },
                executedAt: { gte: since },
            },
        });
    }

    /**
     * Check if a trade is allowed based on global and wallet-specific guardrails.
     * Checks:
     * 1. ENABLE_REAL_TRADING flag
     * 2. Global Daily Volume Cap
     * 3. Per-Wallet Daily Volume Cap
     */
    static async checkExecutionGuardrails(walletAddress: string, amount: number, context: GuardrailContext = {}): Promise<GuardrailResult> {
        const source = context.source || 'guardrail';
        const marketSlug = context.marketSlug?.toLowerCase();

        if (EMERGENCY_PAUSE) {
            GuardrailService.recordGuardrailTrigger({ reason: 'EMERGENCY_PAUSE', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return { allowed: false, reason: 'EMERGENCY_PAUSE' };
        }

        // 1. Kill Switch
        if (!ENABLE_REAL_TRADING) {
            GuardrailService.recordGuardrailTrigger({ reason: 'REAL_TRADING_DISABLED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return { allowed: false, reason: 'REAL_TRADING_DISABLED' };
        }

        if (EXECUTION_ALLOWLIST.length > 0) {
            const normalized = walletAddress.toLowerCase();
            if (!EXECUTION_ALLOWLIST.includes(normalized)) {
                GuardrailService.recordGuardrailTrigger({ reason: 'ALLOWLIST_BLOCKED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                return { allowed: false, reason: 'ALLOWLIST_BLOCKED' };
            }
        }

        if (WORKER_ALLOWLIST.length > 0) {
            const worker = context.workerAddress?.toLowerCase();
            if (!worker || !WORKER_ALLOWLIST.includes(worker)) {
                GuardrailService.recordGuardrailTrigger({ reason: 'WORKER_ALLOWLIST_BLOCKED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                return { allowed: false, reason: 'WORKER_ALLOWLIST_BLOCKED' };
            }
        }

        if (MAX_TRADE_USD > 0 && amount > MAX_TRADE_USD) {
            GuardrailService.recordGuardrailTrigger({ reason: 'MAX_TRADE_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return { allowed: false, reason: `MAX_TRADE_EXCEEDED (${amount.toFixed(2)} > ${MAX_TRADE_USD})` };
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

        // 2. Global Daily Cap
        if (GLOBAL_DAILY_CAP_USD > 0) {
            const globalUsed = await this.getExecutedTotalSince(since);
            if (globalUsed + amount > GLOBAL_DAILY_CAP_USD) {
                GuardrailService.recordGuardrailTrigger({ reason: 'GLOBAL_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                return {
                    allowed: false,
                    reason: `GLOBAL_DAILY_CAP_EXCEEDED (${globalUsed.toFixed(2)} + ${amount.toFixed(2)} > ${GLOBAL_DAILY_CAP_USD})`,
                };
            }
        }

        // 3. Wallet Daily Cap
        if (WALLET_DAILY_CAP_USD > 0) {
            const walletUsed = await this.getExecutedTotalSince(since, walletAddress);
            if (walletUsed + amount > WALLET_DAILY_CAP_USD) {
                GuardrailService.recordGuardrailTrigger({ reason: 'WALLET_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                return {
                    allowed: false,
                    reason: `WALLET_DAILY_CAP_EXCEEDED (${walletUsed.toFixed(2)} + ${amount.toFixed(2)} > ${WALLET_DAILY_CAP_USD})`,
                };
            }
        }

        if (marketSlug) {
            const marketCap = MARKET_CAPS.get(marketSlug) || MARKET_DAILY_CAP_USD;
            if (marketCap > 0) {
                const marketUsed = await this.getExecutedTotalForMarketSince(since, marketSlug);
                if (marketUsed + amount > marketCap) {
                    GuardrailService.recordGuardrailTrigger({ reason: 'MARKET_DAILY_CAP_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                    return {
                        allowed: false,
                        reason: `MARKET_DAILY_CAP_EXCEEDED (${marketUsed.toFixed(2)} + ${amount.toFixed(2)} > ${marketCap})`,
                    };
                }
            }
        }

        if (MAX_TRADES_PER_WINDOW > 0) {
            const windowStart = new Date(Date.now() - TRADE_WINDOW_MS);
            const tradeCount = await this.getExecutedCountSince(windowStart);
            if (tradeCount >= MAX_TRADES_PER_WINDOW) {
                GuardrailService.recordGuardrailTrigger({ reason: 'TRADE_RATE_LIMIT_EXCEEDED', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
                return {
                    allowed: false,
                    reason: `TRADE_RATE_LIMIT_EXCEEDED (${tradeCount} >= ${MAX_TRADES_PER_WINDOW})`,
                };
            }
        }

        if (DRY_RUN) {
            GuardrailService.recordGuardrailTrigger({ reason: 'DRY_RUN', source, walletAddress, amount, tradeId: context.tradeId, tokenId: context.tokenId });
            return { allowed: false, reason: 'DRY_RUN' };
        }

        return { allowed: true };
    }
}
