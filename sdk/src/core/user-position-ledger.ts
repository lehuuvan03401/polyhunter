import { Prisma, PrismaClient } from '@prisma/client';
import { applyBuyToPosition, applySellToPosition } from './position-accounting.js';

type PositionLedgerClient = PrismaClient | Prisma.TransactionClient;

export interface ApplyExecutedTradeToUserPositionParams {
    walletAddress: string;
    tokenId: string;
    side: 'BUY' | 'SELL';
    executedNotionalUsd: number;
    executionPrice: number;
    filledShares?: number | null;
}

export interface ApplyExecutedTradeToUserPositionResult {
    copyShares: number;
    realizedPnL?: number;
}

function normalizeShares(params: ApplyExecutedTradeToUserPositionParams): number {
    const providedFilledShares = Number(params.filledShares || 0);
    if (Number.isFinite(providedFilledShares) && providedFilledShares > 0) {
        return providedFilledShares;
    }

    if (!Number.isFinite(params.executionPrice) || params.executionPrice <= 0) {
        return 0;
    }

    return params.executedNotionalUsd / params.executionPrice;
}

export async function applyExecutedTradeToUserPosition(
    prisma: PositionLedgerClient,
    params: ApplyExecutedTradeToUserPositionParams
): Promise<ApplyExecutedTradeToUserPositionResult> {
    const executedNotionalUsd = Number(params.executedNotionalUsd || 0);
    const executionPrice = Number(params.executionPrice || 0);
    const copyShares = normalizeShares(params);

    if (
        !params.tokenId
        || !Number.isFinite(executedNotionalUsd)
        || executedNotionalUsd <= 0
        || !Number.isFinite(executionPrice)
        || executionPrice <= 0
        || !Number.isFinite(copyShares)
        || copyShares <= 0
    ) {
        return { copyShares: 0 };
    }

    const walletAddress = params.walletAddress.toLowerCase();
    const where = {
        walletAddress_tokenId: {
            walletAddress,
            tokenId: params.tokenId,
        },
    };

    const existingPosition = await prisma.userPosition.findUnique({ where });

    if (params.side === 'BUY') {
        const accounting = applyBuyToPosition({
            currentBalance: existingPosition?.balance || 0,
            currentTotalCost: existingPosition?.totalCost || 0,
            buyShares: copyShares,
            buyTotalValue: executedNotionalUsd,
        });

        if (existingPosition) {
            await prisma.userPosition.update({
                where,
                data: {
                    balance: accounting.nextBalance,
                    totalCost: accounting.nextTotalCost,
                    avgEntryPrice: accounting.nextAvgEntryPrice,
                    updatedAt: new Date(),
                },
            });
        } else {
            await prisma.userPosition.create({
                data: {
                    walletAddress,
                    tokenId: params.tokenId,
                    balance: accounting.nextBalance,
                    totalCost: accounting.nextTotalCost,
                    avgEntryPrice: accounting.nextAvgEntryPrice,
                },
            });
        }

        return { copyShares };
    }

    if (!existingPosition || existingPosition.balance <= 0) {
        return {
            copyShares,
            realizedPnL: executedNotionalUsd,
        };
    }

    const accounting = applySellToPosition({
        currentBalance: existingPosition.balance,
        currentTotalCost: existingPosition.totalCost,
        currentAvgEntryPrice: existingPosition.avgEntryPrice,
        sellShares: copyShares,
        sellTotalValue: executedNotionalUsd,
    });

    await prisma.userPosition.update({
        where,
        data: {
            balance: accounting.remainingBalance,
            totalCost: accounting.remainingTotalCost,
            avgEntryPrice: accounting.remainingAvgEntryPrice,
            updatedAt: new Date(),
        },
    });

    return {
        copyShares: accounting.settledShares,
        realizedPnL: accounting.realizedProfit,
    };
}
