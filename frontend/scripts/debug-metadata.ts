
import 'dotenv/config';
import { prisma } from '../lib/prisma';

const CLOB_API_URL = 'https://clob.polymarket.com';
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

async function fetchMetadata(tokenId: string) {
    console.log(`\n🔍 Investigating Token ID: ${tokenId}`);

    // step 1: Get Condition ID from CLOB /book
    let conditionId: string | null = null;
    try {
        const url = `${CLOB_API_URL}/book?token_id=${tokenId}`;
        console.log(`   👉 Fetching: ${url}`);
        const resp = await fetch(url);
        if (resp.ok) {
            const data = await resp.json();
            console.log(`   ✅ CLOB /book Response:`, JSON.stringify(data));
            conditionId = data.market;
        } else {
            console.warn(`   ❌ CLOB /book Failed: ${resp.status} ${resp.statusText}`);
        }
    } catch (e: any) {
        console.warn(`   ❌ CLOB /book Error:`, e.message);
    }

    if (!conditionId) {
        console.log('   ⚠️ No Condition ID found. Cannot proceed to Gamma check.');
        return;
    }

    console.log(`   🔑 Found Condition ID: ${conditionId}`);

    // Step 2: Check Gamma API
    try {
        // Try query param
        const url = `${GAMMA_API_URL}/markets?condition_id=${conditionId}`;
        console.log(`   👉 Fetching Gamma: ${url}`);
        const resp = await fetch(url);
        if (resp.ok) {
            const data = await resp.json();
            console.log(`   ✅ Gamma Response:`, JSON.stringify(data).substring(0, 200) + '...');
            if (Array.isArray(data) && data.length > 0) {
                console.log(`   🏷️  Slug: ${data[0].slug}`);
            } else if (data.slug) {
                console.log(`   🏷️  Slug: ${data.slug}`);
            }
        } else {
            console.warn(`   ❌ Gamma Failed: ${resp.status} ${resp.statusText}`);
            const text = await resp.text();
            console.log(`   📄 Error Body:`, text.substring(0, 200));
        }
    } catch (e: any) {
        console.warn(`   ❌ Gamma Error:`, e.message);
    }
}

async function main() {
    // 1. Find trades with missing slugs
    const trades = await prisma.copyTrade.findMany({
        where: { marketSlug: null },
        take: 5
    });

    if (trades.length === 0) {
        console.log('✅ No trades with missing slugs found in DB.');

        // Test with a known "problematic" token ID from logs if possible
        // 722624010050744...
        // I will try to fetch all distinct tokens to be sure
        const allTrades = await prisma.copyTrade.findMany({
            select: { tokenId: true },
            distinct: ['tokenId'],
            take: 5
        });
        console.log('Checking recent unique tokens...');
        for (const t of allTrades) {
            await fetchMetadata(t.tokenId);
        }
    } else {
        console.log(`Found ${trades.length} problematic trades. Analyzing...`);
        for (const t of trades) {
            await fetchMetadata(t.tokenId);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
