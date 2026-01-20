/**
 * Position Service
 * 
 * Tracks user positions (cost basis) for accurate profit calculation.
 * Uses Weighted Average method for entry price calculation.
 */

import { PrismaClient } from '@prisma/client';

export interface TradeEvent {
    walletAddress: string;
    tokenId: string;
    side: 'BUY' | 'SELL';
    amount: number;      // Number of shares
    price: number;       // Price per share in USDC
    totalValue: number;  // Total USDC value of trade
}

export interface ProfitResult {
    realized: boolean;
    profit: number;        // Absolute profit in USDC (can be negative)
    profitPercent: number; // Profit as percentage
}

export class PositionService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Updates position on BUY - recalculates weighted average entry price.
     * Returns the updated position.
     */
    /**
     * Updates position on BUY - recalculates weighted average entry price atomically.
     */
    async recordBuy(trade: TradeEvent): Promise<void> {
        const { walletAddress, tokenId, amount, price, totalValue } = trade;

        // Atomic Upsert using Raw SQL to prevent race conditions
        // Formula:
        // NewBalance = OldBalance + Amount
        // NewTotalCost = OldTotalCost + TotalValue
        // NewAvg = NewTotalCost / NewBalance

        try {
            await this.prisma.$executeRaw`
                INSERT INTO "UserPosition" ("id", "walletAddress", "tokenId", "balance", "avgEntryPrice", "totalCost", "createdAt", "updatedAt")
                VALUES (
                    gen_random_uuid(), 
                    ${walletAddress}, 
                    ${tokenId}, 
                    ${amount}, 
                    ${price}, 
                    ${totalValue},
                    NOW(),
                    NOW()
                )
                ON CONFLICT ("walletAddress", "tokenId") 
                DO UPDATE SET
                    "balance" = "UserPosition"."balance" + ${amount},
                    "totalCost" = "UserPosition"."totalCost" + ${totalValue},
                    "avgEntryPrice" = ("UserPosition"."totalCost" + ${totalValue}) / ("UserPosition"."balance" + ${amount}),
                    "updatedAt" = NOW();
            `;

            console.log(`[PositionService] BUY recorded atomically: ${walletAddress} +${amount}`);
        } catch (e) {
            console.error('[PositionService] Atomic Buy Failed:', e);
            throw e;
        }
    }

    /**
     * Calculates profit on SELL and updates position atomically.
     * Note: We still need a read to calculate profit returned to caller, 
     * but the balance update involves a check.
     * Ideally, we use RETURNING to get the state before update or locking.
     * For now, simpler optimization: Atomic decrement.
     */
    async recordSell(trade: TradeEvent): Promise<ProfitResult> {
        const { walletAddress, tokenId, amount, price, totalValue } = trade;

        // 1. We MUST read current avgEntryPrice to calculate realized profit.
        // There is still a small race here if AvgPrice changes between Read and Sell Execution (very rare during Sell).
        // But the critical part is Balance consistency.

        // Transaction to lock the row?
        return await this.prisma.$transaction(async (tx) => {
            const position = await tx.userPosition.findUnique({
                where: { walletAddress_tokenId: { walletAddress, tokenId } }
            });

            if (!position || position.balance <= 0) {
                return { realized: true, profit: totalValue, profitPercent: 1.0 };
            }

            const costBasis = position.avgEntryPrice * amount;
            const profit = totalValue - costBasis;
            const profitPercent = costBasis > 0 ? profit / costBasis : 0;

            // Atomic Decrement
            // We use raw SQL or updateMany with filter to ensure we don't go below zero if race happens?
            // Actually, just standard decrement is safer now inside transaction if isolation level is sufficient.
            // But raw SQL is safest for "balance = balance - amount".

            await tx.$executeRaw`
                UPDATE "UserPosition"
                SET 
                    "balance" = GREATEST(0, "balance" - ${amount}),
                    "totalCost" = GREATEST(0, "balance" - ${amount}) * "avgEntryPrice",
                    "updatedAt" = NOW()
                WHERE "walletAddress" = ${walletAddress} AND "tokenId" = ${tokenId}
            `;

            console.log(`[PositionService] SELL recorded: Profit $${profit.toFixed(4)}`);

            return { realized: true, profit, profitPercent };
        });
    }

    /**
     * Get current position for a user/token pair.
     */
    async getPosition(walletAddress: string, tokenId: string) {
        return this.prisma.userPosition.findUnique({
            where: {
                walletAddress_tokenId: { walletAddress, tokenId }
            }
        });
    }
}

// Singleton instance
import { prisma } from '@/lib/prisma';
export const positionService = new PositionService(prisma);
