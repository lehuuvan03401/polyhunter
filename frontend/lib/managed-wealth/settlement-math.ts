export type ReserveEntryType = 'DEPOSIT' | 'WITHDRAW' | 'GUARANTEE_TOPUP' | 'ADJUSTMENT';

export interface ReserveLedgerEntry {
    entryType: ReserveEntryType;
    amount: number;
}

export interface ManagedSettlementInput {
    principal: number;
    finalEquity: number;
    highWaterMark: number;
    performanceFeeRate: number;
    isGuaranteed: boolean;
    minYieldRate?: number | null;
}

export interface ManagedSettlementOutput {
    principal: number;
    finalEquity: number;
    grossPnl: number;
    highWaterMark: number;
    hwmEligibleProfit: number;
    performanceFeeRate: number;
    performanceFee: number;
    preGuaranteePayout: number;
    guaranteedPayout: number | null;
    reserveTopup: number;
    finalPayout: number;
}

export function calculateManagedSettlement(input: ManagedSettlementInput): ManagedSettlementOutput {
    const principal = Number(input.principal);
    const finalEquity = Number(input.finalEquity);
    const highWaterMark = Math.max(Number(input.highWaterMark), principal);
    const performanceFeeRate = Number(input.performanceFeeRate);

    const grossPnl = finalEquity - principal;
    const hwmEligibleProfit = Math.max(0, finalEquity - highWaterMark);
    const performanceFee = hwmEligibleProfit * performanceFeeRate;
    const preGuaranteePayout = principal + grossPnl - performanceFee;

    let guaranteedPayout: number | null = null;
    let reserveTopup = 0;

    if (input.isGuaranteed) {
        const minYieldRate = Number(input.minYieldRate ?? 0);
        guaranteedPayout = principal * (1 + minYieldRate);
        reserveTopup = Math.max(0, guaranteedPayout - preGuaranteePayout);
    }

    const finalPayout = preGuaranteePayout + reserveTopup;

    return {
        principal,
        finalEquity,
        grossPnl,
        highWaterMark,
        hwmEligibleProfit,
        performanceFeeRate,
        performanceFee,
        preGuaranteePayout,
        guaranteedPayout,
        reserveTopup,
        finalPayout,
    };
}

export function calculateReserveBalance(entries: ReserveLedgerEntry[]): number {
    return entries.reduce((acc, row) => {
        if (row.entryType === 'DEPOSIT' || row.entryType === 'ADJUSTMENT') return acc + row.amount;
        if (row.entryType === 'WITHDRAW' || row.entryType === 'GUARANTEE_TOPUP') return acc - row.amount;
        return acc;
    }, 0);
}

export function calculateGuaranteeLiability(principal: number, minYieldRate: number | null | undefined): number {
    return Number(principal) * Number(minYieldRate ?? 0);
}

export function calculateCoverageRatio(
    reserveBalance: number,
    currentLiability: number,
    additionalLiability = 0
): number {
    const total = currentLiability + additionalLiability;
    if (total <= 0) return Number.POSITIVE_INFINITY;
    return reserveBalance / total;
}
