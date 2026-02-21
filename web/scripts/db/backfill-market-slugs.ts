/**
 * Backfill Missing Market Slugs
 * 
 * This script finds CopyTrade records with missing marketSlug/outcome
 * and attempts to fetch the info from Polymarket CLOB API using conditionId.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PolymarketSDK } from '@catalyst-team/poly-sdk';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

const polyClient = new PolymarketSDK();

async function main() {
    console.log('🔍 Finding CopyTrades with missing marketSlug...\n');

    // Find records with missing marketSlug but have conditionId
    const missingSlugTrades = await prisma.copyTrade.findMany({
        where: {
            marketSlug: null,
            conditionId: { not: null }
        },
        select: {
            id: true,
            tokenId: true,
            conditionId: true,
            outcome: true
        },
        distinct: ['conditionId']
    });

    console.log(`Found ${missingSlugTrades.length} unique conditionIds to process.\n`);

    let updated = 0;
    let failed = 0;

    for (const trade of missingSlugTrades) {
        if (!trade.conditionId) continue;

        try {
            console.log(`📡 Fetching market info for conditionId: ${trade.conditionId.slice(0, 20)}...`);

            // @ts-ignore - getClobMarket is available
            const market = await polyClient.markets.getClobMarket(trade.conditionId);

            if (market && market.marketSlug) {
                // Update all trades with this conditionId
                const result = await prisma.copyTrade.updateMany({
                    where: { conditionId: trade.conditionId },
                    data: {
                        marketSlug: market.marketSlug,
                        // Also update outcome if missing and we can find it
                        outcome: trade.outcome || (market.tokens?.find((t: any) => t.tokenId === trade.tokenId)?.outcome) || undefined
                    }
                });

                console.log(`   ✅ Updated ${result.count} trades with slug: ${market.marketSlug}`);
                updated += result.count;
            } else {
                console.log(`   ⚠️  No market found`);
                failed++;
            }
        } catch (err) {
            console.log(`   ❌ Error: ${(err as Error).message}`);
            failed++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n✨ Backfill complete!`);
    console.log(`   Updated: ${updated} trades`);
    console.log(`   Failed: ${failed} conditionIds`);

    // Also try to backfill using tokenId directly (for trades without conditionId)
    console.log('\n🔍 Finding CopyTrades missing both marketSlug and conditionId...\n');

    const noConditionTrades = await prisma.copyTrade.findMany({
        where: {
            marketSlug: null,
            conditionId: null,
            tokenId: { not: null }
        },
        select: {
            id: true,
            tokenId: true
        },
        distinct: ['tokenId'],
        take: 50 // Limit for safety
    });

    console.log(`Found ${noConditionTrades.length} unique tokenIds without conditionId.`);
    console.log(`These cannot be automatically backfilled - need conditionId from future simulation runs.\n`);

    await prisma.$disconnect();
    await pool.end();
}

main().catch(console.error);
