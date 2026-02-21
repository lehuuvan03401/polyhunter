import { describe, expect, it } from 'vitest';
import {
    calculateCoverageRatio,
    calculateGuaranteeLiability,
    calculateManagedSettlement,
    calculateReserveBalance,
} from './settlement-math';

describe('managed wealth settlement math', () => {
    it('applies high-water-mark fee on eligible profit only', () => {
        const result = calculateManagedSettlement({
            principal: 1000,
            finalEquity: 1300,
            highWaterMark: 1200,
            performanceFeeRate: 0.2,
            isGuaranteed: false,
        });

        expect(result.grossPnl).toBe(300);
        expect(result.hwmEligibleProfit).toBe(100);
        expect(result.performanceFee).toBe(20);
        expect(result.preGuaranteePayout).toBe(1280);
        expect(result.finalPayout).toBe(1280);
        expect(result.reserveTopup).toBe(0);
    });

    it('tops up guaranteed payout when below floor', () => {
        const result = calculateManagedSettlement({
            principal: 1000,
            finalEquity: 900,
            highWaterMark: 1000,
            performanceFeeRate: 0.1,
            isGuaranteed: true,
            minYieldRate: 0.05,
        });

        expect(result.preGuaranteePayout).toBe(900);
        expect(result.guaranteedPayout).toBe(1050);
        expect(result.reserveTopup).toBe(150);
        expect(result.finalPayout).toBe(1050);
    });

    it('does not top up guaranteed payout when performance is already above floor', () => {
        const result = calculateManagedSettlement({
            principal: 1000,
            finalEquity: 1120,
            highWaterMark: 1000,
            performanceFeeRate: 0.1,
            isGuaranteed: true,
            minYieldRate: 0.05,
        });

        expect(result.guaranteedPayout).toBe(1050);
        expect(result.reserveTopup).toBe(0);
        expect(result.finalPayout).toBe(1108);
    });
});

describe('reserve math', () => {
    it('computes reserve balance from ledger entries', () => {
        const balance = calculateReserveBalance([
            { entryType: 'DEPOSIT', amount: 1000 },
            { entryType: 'ADJUSTMENT', amount: 50 },
            { entryType: 'GUARANTEE_TOPUP', amount: 100 },
            { entryType: 'WITHDRAW', amount: 75 },
        ]);

        expect(balance).toBe(875);
    });

    it('computes guarantee liability and coverage ratio', () => {
        const existingLiability = calculateGuaranteeLiability(1000, 0.05) + calculateGuaranteeLiability(500, 0.02);
        const coverage = calculateCoverageRatio(1000, existingLiability, calculateGuaranteeLiability(200, 0.1));

        expect(existingLiability).toBe(60);
        expect(coverage).toBeCloseTo(12.5, 6);
    });

    it('returns infinity coverage when liability is zero', () => {
        const coverage = calculateCoverageRatio(1000, 0, 0);
        expect(coverage).toBe(Number.POSITIVE_INFINITY);
    });
});
