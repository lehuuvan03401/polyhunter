
import { parseOutcome } from '../lib/utils';
// Node 18+ has native fetch

// Real Data from DB Dump (Step 1677)
const mockMetadata = [
    {
        tokenId: "39614849141812185431304908614373516203758348210837500807894351469188267365141",
        marketSlug: "eth-updown-15m-1769177700",
        outcome: "Down",
        conditionId: "0xee57b84fa5b21213b1ae2c31404a34f27f6214a6e7ce7da878045d9b1a070f8b"
    }
];

const SLUG = "eth-updown-15m-1769177700";

async function testLogic() {
    console.log(`Fetching Gamma data for ${SLUG}...`);
    try {
        const res = await fetch(`https://gamma-api.polymarket.com/markets?slug=${SLUG}&limit=1`);
        const data = await res.json();
        const market = data[0];

        if (!market) {
            console.error("Market not found in Gamma!");
            return;
        }

        console.log("Gamma Market Slug:", market.slug);
        console.log("Gamma Outcomes:", market.outcomes);
        console.log("Gamma Prices:", market.outcomePrices);
        console.log("Gamma ConditionID:", market.conditionId);

        const gammaPriceMap = new Map();
        const uniqueTokenIds = [mockMetadata[0].tokenId];
        const metadataMap = new Map();
        metadataMap.set(mockMetadata[0].tokenId, mockMetadata[0]);

        // Parse Outcome Prices
        let outcomePrices: number[] = [];
        if (market.outcomePrices) {
            try {
                outcomePrices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices).map(Number) : market.outcomePrices.map(Number);
            } catch {
                if (Array.isArray(market.outcomePrices)) outcomePrices = market.outcomePrices.map(Number);
            }
        }

        // Logic from positions/route.ts
        if (outcomePrices.length > 0 && market.outcomes) {
            let outcomes: string[] = [];
            try { outcomes = typeof market.outcomes === 'string' ? JSON.parse(market.outcomes) : market.outcomes; } catch { if (Array.isArray(market.outcomes)) outcomes = market.outcomes; }

            outcomes.forEach((outcomeName, idx) => {
                const price = outcomePrices[idx] || 0;
                console.log(`Outcome: ${outcomeName}, Price: ${price}`);

                uniqueTokenIds.forEach(tid => {
                    const meta = metadataMap.get(tid);
                    if (meta) {
                        const conditionMatch = meta.conditionId === market.conditionId;
                        const slugMatch = meta.marketSlug === market.slug;
                        const parsedDB = parseOutcome(meta.outcome);
                        const parsedGamma = parseOutcome(outcomeName);
                        const outcomeMatch = parsedDB === parsedGamma;

                        console.log(`Check TiD ${tid}:`);
                        console.log(`  ConditionMatch: ${meta.conditionId} === ${market.conditionId} -> ${conditionMatch}`);
                        console.log(`  SlugMatch: ${meta.marketSlug} === ${market.slug} -> ${slugMatch}`);
                        console.log(`  OutcomeMatch: ${parsedDB} === ${parsedGamma} -> ${outcomeMatch} ("${meta.outcome}" vs "${outcomeName}")`);

                        // Relaxed match
                        if ((conditionMatch || slugMatch) && outcomeMatch) {
                            if (!gammaPriceMap.has(tid)) {
                                gammaPriceMap.set(tid, price);
                                console.log(`[Price Map] Set ${tid} to ${price}`);
                            }
                        }
                    }
                });
            });
        }

        console.log("Gamma Price Map Size:", gammaPriceMap.size);

    } catch (e) {
        console.error("Fetch failed", e);
    }
}

testLogic();
