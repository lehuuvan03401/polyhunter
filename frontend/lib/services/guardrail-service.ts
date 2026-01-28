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

export interface GuardrailResult {
    allowed: boolean;
    reason?: string;
}

export class GuardrailService {
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
            return { allowed: false, reason: 'REAL_TRADING_DISABLED' };
        }

        if (EXECUTION_ALLOWLIST.length > 0) {
            const normalized = walletAddress.toLowerCase();
            if (!EXECUTION_ALLOWLIST.includes(normalized)) {
                return { allowed: false, reason: 'ALLOWLIST_BLOCKED' };
            }
        }

        if (MAX_TRADE_USD > 0 && amount > MAX_TRADE_USD) {
            return { allowed: false, reason: `MAX_TRADE_EXCEEDED (${amount.toFixed(2)} > ${MAX_TRADE_USD})` };
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

        // 2. Global Daily Cap
        if (GLOBAL_DAILY_CAP_USD > 0) {
            const globalUsed = await this.getExecutedTotalSince(since);
            if (globalUsed + amount > GLOBAL_DAILY_CAP_USD) {
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
                return {
                    allowed: false,
                    reason: `WALLET_DAILY_CAP_EXCEEDED (${walletUsed.toFixed(2)} + ${amount.toFixed(2)} > ${WALLET_DAILY_CAP_USD})`,
                };
            }
        }

        return { allowed: true };
    }
}
