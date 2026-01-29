import { prisma } from '@/lib/prisma';

// Configuration from environment
const ENABLE_REAL_TRADING = process.env.ENABLE_REAL_TRADING === 'true';
const GLOBAL_DAILY_CAP_USD = Number(process.env.COPY_TRADING_DAILY_CAP_USD || '0');
const WALLET_DAILY_CAP_USD = Number(process.env.COPY_TRADING_WALLET_DAILY_CAP_USD || '0');
const EXECUTION_ALLOWLIST = (process.env.COPY_TRADING_EXECUTION_ALLOWLIST || '')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean);
const MAX_TRADE_USD = Number(process.env.COPY_TRADING_MAX_TRADE_USD || '0');
const GUARDRAIL_LOG_INTERVAL_MS = Number(process.env.COPY_TRADING_GUARDRAIL_LOG_INTERVAL_MS || '60000');
const GUARDRAIL_ALERT_THRESHOLD = Number(process.env.COPY_TRADING_GUARDRAIL_ALERT_THRESHOLD || '20');

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
     * Check if a trade is allowed based on global and wallet-specific guardrails.
     * Checks:
     * 1. ENABLE_REAL_TRADING flag
     * 2. Global Daily Volume Cap
     * 3. Per-Wallet Daily Volume Cap
     */
    static async checkExecutionGuardrails(walletAddress: string, amount: number): Promise<GuardrailResult> {
        // 1. Kill Switch
        if (!ENABLE_REAL_TRADING) {
            GuardrailService.recordGuardrailTrigger({ reason: 'REAL_TRADING_DISABLED', source: 'guardrail', walletAddress, amount });
            return { allowed: false, reason: 'REAL_TRADING_DISABLED' };
        }

        if (EXECUTION_ALLOWLIST.length > 0) {
            const normalized = walletAddress.toLowerCase();
            if (!EXECUTION_ALLOWLIST.includes(normalized)) {
                GuardrailService.recordGuardrailTrigger({ reason: 'ALLOWLIST_BLOCKED', source: 'guardrail', walletAddress, amount });
                return { allowed: false, reason: 'ALLOWLIST_BLOCKED' };
            }
        }

        if (MAX_TRADE_USD > 0 && amount > MAX_TRADE_USD) {
            GuardrailService.recordGuardrailTrigger({ reason: 'MAX_TRADE_EXCEEDED', source: 'guardrail', walletAddress, amount });
            return { allowed: false, reason: `MAX_TRADE_EXCEEDED (${amount.toFixed(2)} > ${MAX_TRADE_USD})` };
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

        // 2. Global Daily Cap
        if (GLOBAL_DAILY_CAP_USD > 0) {
            const globalUsed = await this.getExecutedTotalSince(since);
            if (globalUsed + amount > GLOBAL_DAILY_CAP_USD) {
                GuardrailService.recordGuardrailTrigger({ reason: 'GLOBAL_DAILY_CAP_EXCEEDED', source: 'guardrail', walletAddress, amount });
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
                GuardrailService.recordGuardrailTrigger({ reason: 'WALLET_DAILY_CAP_EXCEEDED', source: 'guardrail', walletAddress, amount });
                return {
                    allowed: false,
                    reason: `WALLET_DAILY_CAP_EXCEEDED (${walletUsed.toFixed(2)} + ${amount.toFixed(2)} > ${WALLET_DAILY_CAP_USD})`,
                };
            }
        }

        return { allowed: true };
    }
}
