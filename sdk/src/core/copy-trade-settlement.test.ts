import { describe, expect, it } from 'vitest';

import { buildSettlementOutcomeDecisions } from './copy-trade-settlement.js';

describe('buildSettlementOutcomeDecisions', () => {
    it('classifies winners and losses from Gamma tokens when the market is closed', () => {
        const decisions = buildSettlementOutcomeDecisions({
            outcomes: ['Yes', 'No'],
            outcomePrices: [1, 0],
            closed: true,
            tokens: [
                { tokenId: 'yes-token', outcome: 'Yes', winner: true },
                { tokenId: 'no-token', outcome: 'No', winner: false },
            ],
        });

        expect(decisions).toEqual([
            {
                outcome: 'Yes',
                tokenId: 'yes-token',
                settlementType: 'WIN',
                settlementValue: 1,
                outcomeIndex: 0,
                indexSet: 1,
            },
            {
                outcome: 'No',
                tokenId: 'no-token',
                settlementType: 'LOSS',
                settlementValue: 0,
                outcomeIndex: 1,
                indexSet: 2,
            },
        ]);
    });

    it('uses fallback token mapping when Gamma token metadata is absent', () => {
        const decisions = buildSettlementOutcomeDecisions({
            outcomes: ['Yes', 'No'],
            outcomePrices: [0.97, 0.03],
            closed: true,
            fallbackTokenIdsByOutcome: new Map([
                ['Yes', 'fallback-yes'],
                ['No', 'fallback-no'],
            ]),
        });

        expect(decisions.map((decision) => decision.tokenId)).toEqual(['fallback-yes', 'fallback-no']);
        expect(decisions.map((decision) => decision.settlementType)).toEqual(['WIN', 'LOSS']);
    });

    it('skips unresolved low-price outcomes before the market is closed', () => {
        const decisions = buildSettlementOutcomeDecisions({
            outcomes: ['Yes', 'No'],
            outcomePrices: [0.94, 0.02],
            closed: false,
            fallbackTokenIdsByOutcome: new Map([
                ['Yes', 'fallback-yes'],
                ['No', 'fallback-no'],
            ]),
        });

        expect(decisions).toEqual([]);
    });
});
