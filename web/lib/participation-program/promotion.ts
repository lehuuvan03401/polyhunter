import type { PrismaClient } from '@prisma/client';
import { PARTICIPATION_LEVEL_RULES, type ParticipationLevel } from './levels';

export type DoubleZonePromotionProgress = {
    walletAddress: string;
    directLegCount: number;
    leftLegWallet: string | null;
    rightLegWallet: string | null;
    leftNetDepositUsd: number;
    rightNetDepositUsd: number;
    weakZoneNetDepositUsd: number;
    strongZoneNetDepositUsd: number;
    promotionLevel: ParticipationLevel;
    nextLevel: Exclude<ParticipationLevel, 'NONE'> | null;
    nextLevelThresholdUsd: number | null;
    nextLevelGapUsd: number;
    legBreakdown: Array<{
        walletAddress: string;
        netDepositUsd: number;
    }>;
};

type AggregateNetDeposit = {
    usd: number;
};

function normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
}

async function getNetDepositUsdMapByWallet(
    prisma: PrismaClient,
    walletAddresses: string[]
): Promise<Map<string, AggregateNetDeposit>> {
    const wallets = Array.from(new Set(walletAddresses.map(normalizeWallet).filter(Boolean)));
    const map = new Map<string, AggregateNetDeposit>();

    if (wallets.length === 0) {
        return map;
    }

    const rows = await prisma.netDepositLedger.groupBy({
        by: ['walletAddress', 'direction'],
        where: {
            walletAddress: { in: wallets },
        },
        _sum: {
            usdAmount: true,
        },
    });

    for (const row of rows) {
        const wallet = normalizeWallet(row.walletAddress);
        const current = map.get(wallet) ?? { usd: 0 };
        const delta = Number(row._sum.usdAmount ?? 0);
        current.usd += row.direction === 'WITHDRAW' ? -delta : delta;
        map.set(wallet, current);
    }

    return map;
}

export function resolvePromotionLevel(weakZoneUsd: number): {
    level: ParticipationLevel;
    nextLevel: Exclude<ParticipationLevel, 'NONE'> | null;
    nextLevelThresholdUsd: number | null;
    nextLevelGapUsd: number;
} {
    const desc = [...PARTICIPATION_LEVEL_RULES].sort((a, b) => b.minNetDepositUsd - a.minNetDepositUsd);
    const asc = [...PARTICIPATION_LEVEL_RULES].sort((a, b) => a.minNetDepositUsd - b.minNetDepositUsd);

    let level: ParticipationLevel = 'NONE';
    for (const rule of desc) {
        if (weakZoneUsd >= rule.minNetDepositUsd) {
            level = rule.level;
            break;
        }
    }

    for (const rule of asc) {
        if (weakZoneUsd < rule.minNetDepositUsd) {
            return {
                level,
                nextLevel: rule.level,
                nextLevelThresholdUsd: rule.minNetDepositUsd,
                nextLevelGapUsd: Number((rule.minNetDepositUsd - weakZoneUsd).toFixed(8)),
            };
        }
    }

    return {
        level,
        nextLevel: null,
        nextLevelThresholdUsd: null,
        nextLevelGapUsd: 0,
    };
}

async function buildSingleWalletProgress(
    prisma: PrismaClient,
    walletAddress: string
): Promise<DoubleZonePromotionProgress> {
    const wallet = normalizeWallet(walletAddress);
    const empty: DoubleZonePromotionProgress = {
        walletAddress: wallet,
        directLegCount: 0,
        leftLegWallet: null,
        rightLegWallet: null,
        leftNetDepositUsd: 0,
        rightNetDepositUsd: 0,
        weakZoneNetDepositUsd: 0,
        strongZoneNetDepositUsd: 0,
        promotionLevel: 'NONE',
        nextLevel: 'V1',
        nextLevelThresholdUsd: 100_000,
        nextLevelGapUsd: 100_000,
        legBreakdown: [],
    };

    const referrer = await prisma.referrer.findUnique({
        where: { walletAddress: wallet },
        select: { id: true },
    });
    if (!referrer) {
        return empty;
    }

    const directLegs = await prisma.teamClosure.findMany({
        where: {
            ancestorId: referrer.id,
            depth: 1,
        },
        select: {
            descendantId: true,
            descendant: {
                select: {
                    walletAddress: true,
                },
            },
        },
    });

    if (directLegs.length === 0) {
        return empty;
    }

    const directLegIds = directLegs.map((row) => row.descendantId);
    const legRows = await prisma.teamClosure.findMany({
        where: {
            ancestorId: { in: directLegIds },
            depth: { gte: 0 },
        },
        select: {
            ancestorId: true,
            descendant: {
                select: {
                    walletAddress: true,
                },
            },
        },
    });

    const walletSetsByLeg = new Map<string, Set<string>>();
    for (const legRow of legRows) {
        const set = walletSetsByLeg.get(legRow.ancestorId) ?? new Set<string>();
        set.add(normalizeWallet(legRow.descendant.walletAddress));
        walletSetsByLeg.set(legRow.ancestorId, set);
    }

    const allWallets = new Set<string>();
    for (const set of walletSetsByLeg.values()) {
        for (const teamWallet of set) {
            allWallets.add(teamWallet);
        }
    }

    const netMap = await getNetDepositUsdMapByWallet(prisma, Array.from(allWallets));

    const legBreakdown = directLegs.map((leg) => {
        const legWallet = normalizeWallet(leg.descendant.walletAddress);
        const walletsInLeg = walletSetsByLeg.get(leg.descendantId) ?? new Set<string>([legWallet]);
        let netUsd = 0;
        for (const teamWallet of walletsInLeg) {
            netUsd += Number(netMap.get(teamWallet)?.usd ?? 0);
        }

        return {
            walletAddress: legWallet,
            netDepositUsd: Number(netUsd.toFixed(8)),
        };
    }).sort((a, b) => b.netDepositUsd - a.netDepositUsd);

    const left = legBreakdown[0] ?? null;
    const right = legBreakdown[1] ?? null;
    const leftUsd = Number(left?.netDepositUsd ?? 0);
    const rightUsd = Number(right?.netDepositUsd ?? 0);
    const weakZoneUsd = right ? Math.min(leftUsd, rightUsd) : 0;
    const strongZoneUsd = Math.max(leftUsd, rightUsd);
    const promotion = resolvePromotionLevel(weakZoneUsd);

    return {
        walletAddress: wallet,
        directLegCount: legBreakdown.length,
        leftLegWallet: left?.walletAddress ?? null,
        rightLegWallet: right?.walletAddress ?? null,
        leftNetDepositUsd: leftUsd,
        rightNetDepositUsd: rightUsd,
        weakZoneNetDepositUsd: Number(weakZoneUsd.toFixed(8)),
        strongZoneNetDepositUsd: Number(strongZoneUsd.toFixed(8)),
        promotionLevel: promotion.level,
        nextLevel: promotion.nextLevel,
        nextLevelThresholdUsd: promotion.nextLevelThresholdUsd,
        nextLevelGapUsd: promotion.nextLevelGapUsd,
        legBreakdown,
    };
}

export async function buildDoubleZonePromotionProgress(
    prisma: PrismaClient,
    walletAddresses: string[]
): Promise<DoubleZonePromotionProgress[]> {
    const wallets = Array.from(new Set(walletAddresses.map(normalizeWallet).filter(Boolean)));
    const result: DoubleZonePromotionProgress[] = [];

    for (const wallet of wallets) {
        result.push(await buildSingleWalletProgress(prisma, wallet));
    }

    return result;
}
