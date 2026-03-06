export type SettlementOutcomeDecision = {
    outcome: string;
    tokenId: string;
    settlementType: 'WIN' | 'LOSS';
    settlementValue: number;
    outcomeIndex: number;
    indexSet: number;
};

type OutcomeTokenLike = {
    tokenId?: string | null;
    token_id?: string | null;
    outcome?: string | null;
    winner?: boolean | null;
};

type BuildSettlementOutcomeDecisionsParams = {
    outcomes: string[];
    outcomePrices: Array<number | string | null | undefined>;
    closed: boolean;
    tokens?: OutcomeTokenLike[] | null;
    fallbackTokenIdsByOutcome?: Map<string, string>;
};

function toFiniteNumber(value: number | string | null | undefined): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

export function buildSettlementOutcomeDecisions(
    params: BuildSettlementOutcomeDecisionsParams
): SettlementOutcomeDecision[] {
    const tokenByOutcome = new Map<string, { tokenId: string; winner?: boolean | null }>();

    for (const token of params.tokens || []) {
        const outcome = token.outcome?.trim();
        const tokenId = token.tokenId || token.token_id;
        if (!outcome || !tokenId) continue;
        tokenByOutcome.set(outcome, { tokenId, winner: token.winner });
    }

    const decisions: SettlementOutcomeDecision[] = [];

    for (const [outcomeIndex, outcome] of params.outcomes.entries()) {
        const tokenInfo = tokenByOutcome.get(outcome);
        const tokenId = tokenInfo?.tokenId || params.fallbackTokenIdsByOutcome?.get(outcome);
        if (!tokenId) {
            continue;
        }

        const price = toFiniteNumber(params.outcomePrices[outcomeIndex]);
        if (price === null) {
            continue;
        }

        const explicitWinner = tokenInfo?.winner;
        if (explicitWinner === true || price >= 0.95) {
            decisions.push({
                outcome,
                tokenId,
                settlementType: 'WIN',
                settlementValue: 1,
                outcomeIndex,
                indexSet: 1 << outcomeIndex,
            });
            continue;
        }

        if ((explicitWinner === false && params.closed) || (price <= 0.05 && params.closed)) {
            decisions.push({
                outcome,
                tokenId,
                settlementType: 'LOSS',
                settlementValue: 0,
                outcomeIndex,
                indexSet: 1 << outcomeIndex,
            });
        }
    }

    return decisions;
}
