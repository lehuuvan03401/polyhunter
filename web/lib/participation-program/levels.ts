import type { PrismaClient } from '@prisma/client';

export type ParticipationLevel = 'NONE' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9';

export type ParticipationLevelRule = {
    level: Exclude<ParticipationLevel, 'NONE'>;
    minNetDepositUsd: number;
    dividendRate: number;
};

export const PARTICIPATION_LEVEL_RULES: ParticipationLevelRule[] = [
    { level: 'V1', minNetDepositUsd: 100_000, dividendRate: 0.30 },
    { level: 'V2', minNetDepositUsd: 300_000, dividendRate: 0.35 },
    { level: 'V3', minNetDepositUsd: 500_000, dividendRate: 0.40 },
    { level: 'V4', minNetDepositUsd: 1_000_000, dividendRate: 0.45 },
    { level: 'V5', minNetDepositUsd: 3_000_000, dividendRate: 0.50 },
    { level: 'V6', minNetDepositUsd: 5_000_000, dividendRate: 0.55 },
    { level: 'V7', minNetDepositUsd: 10_000_000, dividendRate: 0.60 },
    { level: 'V8', minNetDepositUsd: 20_000_000, dividendRate: 0.65 },
    { level: 'V9', minNetDepositUsd: 30_000_000, dividendRate: 0.70 },
];

const DESC_LEVEL_RULES = [...PARTICIPATION_LEVEL_RULES].sort((a, b) => b.minNetDepositUsd - a.minNetDepositUsd);

type AggregateNetDeposit = {
    usd: number;
    mcnEquivalent: number;
};

export type ParticipationLevelProgress = {
    walletAddress: string;
    selfNetDepositUsd: number;
    teamNetDepositUsd: number;
    selfNetDepositMcnEquivalent: number;
    teamNetDepositMcnEquivalent: number;
    level: ParticipationLevel;
    dividendRate: number;
    directTeamWalletCount: number;
    nextLevel: Exclude<ParticipationLevel, 'NONE'> | null;
    nextLevelThresholdUsd: number | null;
    remainingToNextUsd: number;
};

function normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
}

export function startOfUtcDay(input: Date): Date {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function resolveLevelByTeamNetDeposit(teamNetDepositUsd: number): {
    level: ParticipationLevel;
    dividendRate: number;
} {
    for (const rule of DESC_LEVEL_RULES) {
        if (teamNetDepositUsd >= rule.minNetDepositUsd) {
            return {
                level: rule.level,
                dividendRate: rule.dividendRate,
            };
        }
    }

    return {
        level: 'NONE',
        dividendRate: 0,
    };
}

export function resolveNextLevel(teamNetDepositUsd: number): {
    nextLevel: Exclude<ParticipationLevel, 'NONE'> | null;
    nextLevelThresholdUsd: number | null;
    remainingToNextUsd: number;
} {
    const sorted = [...PARTICIPATION_LEVEL_RULES].sort((a, b) => a.minNetDepositUsd - b.minNetDepositUsd);
    for (const rule of sorted) {
        if (teamNetDepositUsd < rule.minNetDepositUsd) {
            return {
                nextLevel: rule.level,
                nextLevelThresholdUsd: rule.minNetDepositUsd,
                remainingToNextUsd: Number((rule.minNetDepositUsd - teamNetDepositUsd).toFixed(8)),
            };
        }
    }

    return {
        nextLevel: null,
        nextLevelThresholdUsd: null,
        remainingToNextUsd: 0,
    };
}

async function getNetDepositMapByWallet(
    prisma: PrismaClient,
    walletAddresses: string[]
): Promise<Map<string, AggregateNetDeposit>> {
    const normalizedWallets = Array.from(new Set(walletAddresses.map(normalizeWallet).filter(Boolean)));
    const map = new Map<string, AggregateNetDeposit>();

    if (normalizedWallets.length === 0) {
        return map;
    }

    const rows = await prisma.netDepositLedger.groupBy({
        by: ['walletAddress', 'direction'],
        where: {
            walletAddress: { in: normalizedWallets },
        },
        _sum: {
            usdAmount: true,
            mcnEquivalentAmount: true,
        },
    });

    for (const row of rows) {
        const wallet = normalizeWallet(row.walletAddress);
        const prev = map.get(wallet) ?? { usd: 0, mcnEquivalent: 0 };
        const usdDelta = Number(row._sum.usdAmount ?? 0);
        const mcnDelta = Number(row._sum.mcnEquivalentAmount ?? 0);

        if (row.direction === 'WITHDRAW') {
            prev.usd -= usdDelta;
            prev.mcnEquivalent -= mcnDelta;
        } else {
            prev.usd += usdDelta;
            prev.mcnEquivalent += mcnDelta;
        }

        map.set(wallet, prev);
    }

    return map;
}

export async function buildParticipationLevelProgress(
    prisma: PrismaClient,
    walletAddresses: string[]
): Promise<ParticipationLevelProgress[]> {
    const wallets = Array.from(new Set(walletAddresses.map(normalizeWallet).filter(Boolean)));
    if (wallets.length === 0) {
        return [];
    }

    const referrers = await prisma.referrer.findMany({
        where: {
            walletAddress: { in: wallets },
        },
        select: {
            id: true,
            walletAddress: true,
        },
    });

    const walletToReferrerId = new Map<string, string>();
    for (const referrer of referrers) {
        walletToReferrerId.set(normalizeWallet(referrer.walletAddress), referrer.id);
    }

    const referrerIds = referrers.map((referrer) => referrer.id);
    const descendantRows = referrerIds.length > 0
        ? await prisma.teamClosure.findMany({
            where: {
                ancestorId: { in: referrerIds },
                depth: { gt: 0 },
            },
            select: {
                ancestorId: true,
                descendant: {
                    select: {
                        walletAddress: true,
                    },
                },
            },
        })
        : [];

    const ancestorWalletSet = new Map<string, Set<string>>();
    for (const row of descendantRows) {
        const set = ancestorWalletSet.get(row.ancestorId) ?? new Set<string>();
        set.add(normalizeWallet(row.descendant.walletAddress));
        ancestorWalletSet.set(row.ancestorId, set);
    }

    const teamWalletMap = new Map<string, Set<string>>();
    const allWalletsForNet = new Set<string>();

    for (const wallet of wallets) {
        const referrerId = walletToReferrerId.get(wallet);
        const teamSet = new Set<string>([wallet]);

        if (referrerId) {
            const descendants = ancestorWalletSet.get(referrerId);
            if (descendants) {
                for (const teamWallet of descendants) {
                    teamSet.add(teamWallet);
                }
            }
        }

        teamWalletMap.set(wallet, teamSet);
        for (const teamWallet of teamSet) {
            allWalletsForNet.add(teamWallet);
        }
    }

    const netMap = await getNetDepositMapByWallet(prisma, Array.from(allWalletsForNet));

    const progress: ParticipationLevelProgress[] = [];
    for (const wallet of wallets) {
        const selfNet = netMap.get(wallet) ?? { usd: 0, mcnEquivalent: 0 };
        const teamWallets = teamWalletMap.get(wallet) ?? new Set<string>([wallet]);

        let teamUsd = 0;
        let teamMcn = 0;
        for (const teamWallet of teamWallets) {
            const teamNet = netMap.get(teamWallet);
            if (!teamNet) continue;
            teamUsd += teamNet.usd;
            teamMcn += teamNet.mcnEquivalent;
        }

        teamUsd = Number(teamUsd.toFixed(8));
        teamMcn = Number(teamMcn.toFixed(8));

        const { level, dividendRate } = resolveLevelByTeamNetDeposit(teamUsd);
        const next = resolveNextLevel(teamUsd);

        progress.push({
            walletAddress: wallet,
            selfNetDepositUsd: Number(selfNet.usd.toFixed(8)),
            teamNetDepositUsd: teamUsd,
            selfNetDepositMcnEquivalent: Number(selfNet.mcnEquivalent.toFixed(8)),
            teamNetDepositMcnEquivalent: teamMcn,
            level,
            dividendRate,
            directTeamWalletCount: Math.max(0, teamWallets.size - 1),
            nextLevel: next.nextLevel,
            nextLevelThresholdUsd: next.nextLevelThresholdUsd,
            remainingToNextUsd: next.remainingToNextUsd,
        });
    }

    return progress;
}
