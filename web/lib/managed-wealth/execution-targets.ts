export type ManagedExecutionTargetSelection = {
    copyConfigId: string;
    allocationVersion: number | null;
    targetWeight: number;
    targetOrder: number;
    isPrimary: boolean;
    isActive: boolean;
};

type ExecutionTargetDb = {
    managedSubscriptionExecutionTarget: {
        findMany: (...args: any[]) => Promise<ManagedExecutionTargetSelection[]>;
    };
};

export function normalizeManagedExecutionConfigIds(input: {
    targets?: Array<Pick<ManagedExecutionTargetSelection, 'copyConfigId' | 'isActive'>> | null;
    fallbackCopyConfigId?: string | null;
}): string[] {
    const ids = new Set<string>();

    for (const target of input.targets ?? []) {
        if (!target?.isActive) continue;
        if (!target.copyConfigId) continue;
        ids.add(target.copyConfigId);
    }

    if (ids.size === 0 && input.fallbackCopyConfigId) {
        ids.add(input.fallbackCopyConfigId);
    }

    return [...ids];
}

export function resolvePrimaryManagedExecutionConfigId(input: {
    targets?: Array<Pick<ManagedExecutionTargetSelection, 'copyConfigId' | 'isActive' | 'isPrimary' | 'targetOrder'>> | null;
    fallbackCopyConfigId?: string | null;
}): string | null {
    const activeTargets = (input.targets ?? [])
        .filter((target) => target?.isActive && Boolean(target.copyConfigId))
        .sort((left, right) => {
            if (left.isPrimary !== right.isPrimary) {
                return left.isPrimary ? -1 : 1;
            }
            return left.targetOrder - right.targetOrder;
        });

    return activeTargets[0]?.copyConfigId ?? input.fallbackCopyConfigId ?? null;
}

export async function listActiveManagedExecutionTargets(
    db: ExecutionTargetDb,
    subscriptionId: string
): Promise<ManagedExecutionTargetSelection[]> {
    return db.managedSubscriptionExecutionTarget.findMany({
        where: {
            subscriptionId,
            isActive: true,
        },
        orderBy: [
            { isPrimary: 'desc' },
            { targetOrder: 'asc' },
            { createdAt: 'asc' },
        ],
        select: {
            copyConfigId: true,
            allocationVersion: true,
            targetWeight: true,
            targetOrder: true,
            isPrimary: true,
            isActive: true,
        },
    });
}

export async function resolveManagedExecutionConfigIds(
    db: ExecutionTargetDb,
    input: {
        subscriptionId: string;
        fallbackCopyConfigId?: string | null;
    }
): Promise<string[]> {
    const targets = await listActiveManagedExecutionTargets(db, input.subscriptionId);
    return normalizeManagedExecutionConfigIds({
        targets,
        fallbackCopyConfigId: input.fallbackCopyConfigId,
    });
}

export async function resolvePrimaryManagedExecutionTarget(
    db: ExecutionTargetDb,
    input: {
        subscriptionId: string;
        fallbackCopyConfigId?: string | null;
    }
): Promise<string | null> {
    const targets = await listActiveManagedExecutionTargets(db, input.subscriptionId);
    return resolvePrimaryManagedExecutionConfigId({
        targets,
        fallbackCopyConfigId: input.fallbackCopyConfigId,
    });
}
