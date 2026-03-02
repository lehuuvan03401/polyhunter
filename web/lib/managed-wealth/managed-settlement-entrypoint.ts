import type { PrismaClient } from '@prisma/client';
import type { ParticipationProfitFeeScope } from '@/lib/participation-program/fee-scope';
import {
    settleManagedProfitFeeIfNeeded,
    type ManagedSettlementMutationResult,
} from './managed-settlement-service';

type SettlementEntryDb = Pick<PrismaClient, 'managedSettlementExecution'>;
type ProfitFeeDistributor = Parameters<typeof settleManagedProfitFeeIfNeeded>[0]['distributor'];

export async function finalizeManagedSettlementEntry(input: {
    db: SettlementEntryDb;
    distributor: ProfitFeeDistributor;
    walletAddress: string;
    mutationResult: ManagedSettlementMutationResult;
    scope?: ParticipationProfitFeeScope;
    sourcePrefix?: string;
    onProfitFeeError?: (error: unknown) => void;
}): Promise<ManagedSettlementMutationResult> {
    if (input.mutationResult.status !== 'COMPLETED') {
        return input.mutationResult;
    }

    try {
        await settleManagedProfitFeeIfNeeded({
            db: input.db,
            distributor: input.distributor,
            walletAddress: input.walletAddress,
            subscriptionId: input.mutationResult.subscription.id,
            settlementId: input.mutationResult.settlement.id,
            grossPnl: input.mutationResult.settlement.grossPnl,
            scope: input.scope ?? 'MANAGED_WITHDRAWAL',
            sourcePrefix: input.sourcePrefix ?? 'managed-withdraw',
        });
    } catch (error) {
        input.onProfitFeeError?.(error);
    }

    return input.mutationResult;
}
