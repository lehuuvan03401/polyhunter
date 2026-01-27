
import { GammaApiClient } from '../src/index';
import { RateLimiter } from '../src/core/rate-limiter';
import { createUnifiedCache } from '../src/core/unified-cache';

const rateLimiter = new RateLimiter();
const cache = createUnifiedCache();
const gammaClient = new GammaApiClient(rateLimiter, cache);

async function main() {
    const slug = 'solana-up-or-down-january-27-12am-et';
    console.log(`Fetching EVENT for: ${slug}`);

    // 1. Get Condition ID from Event
    const eventUrl = `https://gamma-api.polymarket.com/events?slug=${slug}`;
    const eventResp = await fetch(eventUrl);
    const eventData = await eventResp.json();
    const event = Array.isArray(eventData) ? eventData[0] : eventData;

    if (!event || !event.markets || event.markets.length === 0) {
        console.log('No event/market found via slug');
        return;
    }

    const marketMeta = event.markets[0];
    const conditionId = marketMeta.conditionId || marketMeta.condition_id;
    console.log(`Found Condition ID: ${conditionId}`);

    // 2. Fetch Market by Condition ID (Simulating the script's path)
    const marketUrl = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
    console.log(`Fetching MARKET via ID: ${marketUrl}`);

    const mResp = await fetch(marketUrl);
    const mData = await mResp.json();
    const m = Array.isArray(mData) ? mData[0] : mData;

    console.log(`\nMarket Object Keys: ${Object.keys(m)}`);
    console.log(`Closed: ${m.closed} (Type: ${typeof m.closed})`);
    console.log(`Question: ${m.question}`);
    console.log(`Outcomes: ${m.outcomes}`);
    console.log(`Outcome Prices: ${m.outcomePrices}`);

    m.tokens?.forEach((t: any) => {
        console.log(`  Token [${t.outcome || t.token_id}]:`);
        console.log(`    Price: ${t.price}`);
        console.log(`    Winner: ${t.winner}`);
    });
}

main();
