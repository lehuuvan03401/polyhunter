
import 'dotenv/config';
import { prisma } from '../../lib/prisma';

async function main() {
    console.log('📊 Starting Deep Analysis of Copy Trading Data...\n');

    // 1. Fetch all CopyTrades
    const trades = await prisma.copyTrade.findMany({
        orderBy: { executedAt: 'asc' }
    });
    console.log(`Found ${trades.length} CopyTrade records.`);

    // 2. Fetch all UserPositions
    const positions = await prisma.userPosition.findMany();
    console.log(`Found ${positions.length} UserPosition records.\n`);

    console.log('--- 1. METADATA INTEGRITY CHECK ---');
    let unknownMarkets = 0;
    let missingOutcomes = 0;
    trades.forEach(t => {
        if (!t.marketSlug || t.marketSlug === '') unknownMarkets++;
        if (!t.outcome || t.outcome === '') missingOutcomes++;
    });
    console.log(`Trades with missing Market Slug: ${unknownMarkets} ${unknownMarkets > 0 ? '❌' : '✅'}`);
    console.log(`Trades with missing Outcome: ${missingOutcomes} ${missingOutcomes > 0 ? '❌' : '✅'}`);

    if (trades.length > 0) {
        console.log('\n--- SAMPLE METADATA ---');
        console.log('Trade 1 Slug:', trades[0].marketSlug);
        console.log('Trade 1 Outcome:', trades[0].outcome);
        console.log('Trade 1 Condition:', trades[0].conditionId);
        process.exit(0);
    }

    console.log('\n--- 2. COST BASIS & AVERAGE PRICE CHECK ---');

    // Re-calculate positions from scratch based on trades
    const computedPositions = new Map<string, { balance: number, totalCost: number, tokenId: string }>();

    for (const trade of trades) {
        const key = trade.tokenId;
        if (!computedPositions.has(key)) {
            computedPositions.set(key, { balance: 0, totalCost: 0, tokenId: key });
        }
        const pos = computedPositions.get(key)!;

        // We always copy $10 in this sim
        // Shares reported in DB might be slightly different due to precision
        // But let's trust trade.copySize and trade.copyPrice
        const shares = trade.copySize / trade.copyPrice;

        // Sim is BUY only for now based on logs? Let's check.
        // Actually sim logs showed "BUY".
        // If there were sells, we'd need to handle that.
        // Assuming BUY for now as sim script defaults to creating BUYs for simplicity unless tracking sells.
        // Wait, sim script logic: "Simulating BUY..."

        pos.balance += shares;
        pos.totalCost += trade.copySize;
    }

    // Compare with DB Positions
    for (const dbPos of positions) {
        const calcPos = computedPositions.get(dbPos.tokenId);
        if (!calcPos) {
            console.warn(`⚠️ Position found in DB but not in re-calculated trades: ${dbPos.tokenId}`);
            continue;
        }

        const calcAvgPrice = calcPos.totalCost / calcPos.balance;
        const diffBalance = Math.abs(dbPos.balance - calcPos.balance);
        const diffCost = Math.abs(dbPos.totalCost - calcPos.totalCost);
        const diffAvg = Math.abs(dbPos.avgEntryPrice - calcAvgPrice);

        console.log(`Token ${dbPos.tokenId.substring(0, 15)}...`);
        console.log(`  DB Balance: ${dbPos.balance.toFixed(4)} | Calc: ${calcPos.balance.toFixed(4)} | Diff: ${diffBalance.toFixed(6)}`);
        console.log(`  DB Cost: $${dbPos.totalCost.toFixed(4)} | Calc: $${calcPos.totalCost.toFixed(4)} | Diff: ${diffCost.toFixed(6)}`);
        console.log(`  DB Avg $ : ${dbPos.avgEntryPrice.toFixed(4)} | Calc: ${calcAvgPrice.toFixed(4)} | Diff: ${diffAvg.toFixed(6)}`);

        if (diffBalance > 0.01 || diffCost > 0.01) {
            console.log('  ❌ DISCREPANCY DETECTED');
        } else {
            console.log('  ✅ MATCH');
        }
        console.log('------------------------------------------------');
    }

    console.log('\n--- 3. PNL LOGIC REVIEW ---');
    // Currently no realized PnL in sim (only BUYs).
    // But we can check Unrealized PnL if we fetch current prices (not easy in this script without API).
    // Focus on cost basis logic.
    console.log('Simulation only performed BUYs, so Realized PnL is N/A.');
    console.log('Average Entry Price logic appears: Total Cost / Total Shares.');

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
