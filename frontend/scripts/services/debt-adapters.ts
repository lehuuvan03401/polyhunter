
import { PrismaClient } from '@prisma/client';
import { DebtLogger } from '../../../src/services/copy-trading-execution-service.js';
import { DebtRepository, DebtItem } from '../../../src/core/debt-manager.js';

export class PrismaDebtLogger implements DebtLogger {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async logDebt(debt: {
        proxyAddress: string;
        botAddress: string;
        amount: number;
        currency: string;
        error: string;
    }): Promise<void> {
        try {
            await this.prisma.debtRecord.create({
                data: {
                    proxyAddress: debt.proxyAddress,
                    botAddress: debt.botAddress,
                    amount: debt.amount,
                    currency: debt.currency,
                    status: 'PENDING',
                    errorLog: debt.error
                }
            });
        } catch (e) {
            console.error('[PrismaDebtLogger] Failed to persist debt record:', e);
        }
    }
}

export class PrismaDebtRepository implements DebtRepository {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getPendingDebts(): Promise<DebtItem[]> {
        const records = await this.prisma.debtRecord.findMany({
            where: { status: 'PENDING' }
        });

        return records.map(r => ({
            id: r.id,
            proxyAddress: r.proxyAddress,
            botAddress: r.botAddress,
            amount: r.amount,
            currency: r.currency,
            createdAt: r.createdAt
        }));
    }

    async markRepaid(id: string): Promise<void> {
        await this.prisma.debtRecord.update({
            where: { id },
            data: {
                status: 'REPAID',
                repaidAt: new Date()
            }
        });
    }
}
