import { describe, expect, it } from 'vitest';

import { applyBuyToPosition, applySellToPosition } from './position-accounting.js';

describe('applyBuyToPosition', () => {
    it('recalculates weighted average entry price after an additional buy', () => {
        const result = applyBuyToPosition({
            currentBalance: 100,
            currentTotalCost: 40,
            buyShares: 20,
            buyTotalValue: 12,
        });

        expect(result.nextBalance).toBeCloseTo(120);
        expect(result.nextTotalCost).toBeCloseTo(52);
        expect(result.nextAvgEntryPrice).toBeCloseTo(52 / 120);
    });
});

describe('applySellToPosition', () => {
    it('preserves remaining average entry price after a partial sell', () => {
        const result = applySellToPosition({
            currentBalance: 100,
            currentTotalCost: 40,
            currentAvgEntryPrice: 0.4,
            sellShares: 25,
            sellTotalValue: 15,
        });

        expect(result.remainingBalance).toBeCloseTo(75);
        expect(result.remainingTotalCost).toBeCloseTo(30);
        expect(result.remainingAvgEntryPrice).toBeCloseTo(0.4);
        expect(result.realizedProfit).toBeCloseTo(5);
        expect(result.realizedProfitPercent).toBeCloseTo(0.5);
    });

    it('clears total cost and average entry price after a full sell', () => {
        const result = applySellToPosition({
            currentBalance: 100,
            currentTotalCost: 40,
            currentAvgEntryPrice: 0.4,
            sellShares: 100,
            sellTotalValue: 70,
        });

        expect(result.remainingBalance).toBe(0);
        expect(result.remainingTotalCost).toBe(0);
        expect(result.remainingAvgEntryPrice).toBe(0);
        expect(result.realizedProfit).toBeCloseTo(30);
        expect(result.realizedProfitPercent).toBeCloseTo(0.75);
    });
});
