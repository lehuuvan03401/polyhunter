
import 'dotenv/config';
import { prisma } from '../lib/prisma';

const CLOB_API_URL = 'https://clob.polymarket.com';
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

async function fetchAndFixMetadata(tokenId: string) {
    console.log(`\n🔍 Checking Token ID: ${tokenId}...`);

    // 1. Get current record to see what's missing
    const existing = await prisma.copyTrade.findFirst({ where: { tokenId } });
    if (!existing) return;

    if (existing.marketSlug && existing.conditionId) {
        console.log(`   ✅ Already has metadata: ${existing.marketSlug}`);
        return;
    }

    // step 1: Get Condition ID from CLOB /book
    let conditionId: string | null = existing.conditionId;

    if (!conditionId) {
        try {
            const url = `${CLOB_API_URL}/book?token_id=${tokenId}`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                conditionId = data.market;
                console.log(`   🔑 Found Condition ID: ${conditionId}`);
            }
        } catch (e: any) {
            console.warn(`   ❌ CLOB /book Error:`, e.message);
        }
    }

    if (!conditionId) {
        console.log('   ⚠️ No Condition ID found. Skipping.');
        return;
    }

    // Step 2: Check Gamma API for Slug
    try {
        const url = `${GAMMA_API_URL}/markets?condition_id=${conditionId}`;
        const resp = await fetch(url);
        if (resp.ok) {
            const data = await resp.json();
            let slug = '';
            let outcome = '';

            // Handle Array or Object
            const market = Array.isArray(data) ? data[0] : data;

            if (market && market.slug) {
                slug = market.slug;
                console.log(`   🏷️  Found Slug: ${slug}`);

                // Find outcome
                if (market.tokens) {
                    const token = market.tokens.find((t: any) => t.token_id === tokenId || t.tokenId === tokenId);
                    if (token) outcome = token.outcome;
                }
            }

            // UPDATE DB
            if (slug) {
                console.log(`   💾 Updating DB records for token ${tokenId.slice(0, 10)}...`);

                // Update CopyTrade
                await prisma.copyTrade.updateMany({
                    where: { tokenId: tokenId },
                    data: {
                        marketSlug: slug,
                        conditionId: conditionId,
                        ...(outcome ? { outcome } : {})
                    }
                });

                // Also update UserPosition logic? 
                // Positions don't store slug, they join with CopyTrade. 
                // Wait, UserPosition doesn't have slug. `api/copy-trading/positions` grabs it from CopyTrade table.
                // So updating CopyTrade is sufficient!
                console.log('   ✅ DB Updated!');
            } else {
                console.log('   ⚠️ Gamma returned data but no slug found.');
            }

        } else {
            console.warn(`   ❌ Gamma Failed: ${resp.status}`);
        }
    } catch (e: any) {
        console.warn(`   ❌ Gamma Error:`, e.message);
    }
}

async function main() {
    // 1. Find all Unique Token IDs in CopyTrade
    const trades = await prisma.copyTrade.findMany({
        select: { tokenId: true },
        distinct: ['tokenId'],
    });

    console.log(`Checking ${trades.length} unique tokens for missing metadata...`);

    for (const t of trades) {
        await fetchAndFixMetadata(t.tokenId);
        // Rate limit kindness
        await new Promise(r => setTimeout(r, 200));
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
