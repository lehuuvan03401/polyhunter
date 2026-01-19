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
    async recordBuy(trade: TradeEvent): Promise<void> {
        const { walletAddress, tokenId, amount, price, totalValue } = trade;

        // Get or create position
        const existing = await this.prisma.userPosition.findUnique({
            where: {
                walletAddress_tokenId: { walletAddress, tokenId }
            }
        });

        if (existing && existing.balance > 0) {
            // Weighted Average: newAvg = (oldCost + newCost) / (oldQty + newQty)
            const oldCost = existing.balance * existing.avgEntryPrice;
            const newTotalCost = oldCost + totalValue;
            const newTotalQty = existing.balance + amount;
            const newAvgPrice = newTotalCost / newTotalQty;

            await this.prisma.userPosition.update({
                where: { id: existing.id },
                data: {
                    balance: newTotalQty,
                    avgEntryPrice: newAvgPrice,
                    totalCost: newTotalCost
                }
            });
        } else {
            // First buy or zero balance - simple case
            await this.prisma.userPosition.upsert({
                where: {
                    walletAddress_tokenId: { walletAddress, tokenId }
                },
                create: {
                    walletAddress,
                    tokenId,
                    balance: amount,
                    avgEntryPrice: price,
                    totalCost: totalValue
                },
                update: {
                    balance: amount,
                    avgEntryPrice: price,
                    totalCost: totalValue
                }
            });
        }

        console.log(`[PositionService] BUY recorded: ${walletAddress} +${amount} @ $${price.toFixed(4)}`);
    }

    /**
     * Calculates profit on SELL and updates position.
     * Returns profit information.
     */
    async recordSell(trade: TradeEvent): Promise<ProfitResult> {
        const { walletAddress, tokenId, amount, price, totalValue } = trade;

        const position = await this.prisma.userPosition.findUnique({
            where: {
                walletAddress_tokenId: { walletAddress, tokenId }
            }
        });

        if (!position || position.balance <= 0) {
            console.warn(`[PositionService] No position found for ${walletAddress} / ${tokenId}. Assuming zero cost basis.`);
            // No existing position - treat as 100% profit (edge case)
            return {
                realized: true,
                profit: totalValue,
                profitPercent: 1.0
            };
        }

        // Calculate profit based on average entry price
        const costBasis = position.avgEntryPrice * amount;
        const proceeds = totalValue;
        const profit = proceeds - costBasis;
        const profitPercent = costBasis > 0 ? profit / costBasis : 0;

        // Update position - reduce balance (avgEntryPrice stays same for SELL)
        const newBalance = Math.max(0, position.balance - amount);
        const newTotalCost = newBalance * position.avgEntryPrice;

        await this.prisma.userPosition.update({
            where: { id: position.id },
            data: {
                balance: newBalance,
                totalCost: newTotalCost
                // avgEntryPrice unchanged on SELL
            }
        });

        console.log(`[PositionService] SELL recorded: ${walletAddress} -${amount} @ $${price.toFixed(4)} | Profit: $${profit.toFixed(4)} (${(profitPercent * 100).toFixed(2)}%)`);

        return {
            realized: true,
            profit,
            profitPercent
        };
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
