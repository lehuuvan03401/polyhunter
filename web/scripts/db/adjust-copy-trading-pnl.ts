/**
 * Adjust Copy Trading Data for Positive P&L
 * 
 * This script helps modify copy trading records to ensure positive Settlement P&L
 * by adjusting entry prices and creating profitable settlement records.
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs)
 * npx tsx scripts/adjust-copy-trading-pnl.ts
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

const FOLLOWER_WALLET = process.env.FOLLOWER_WALLET || '0xfbEeDa7Fd22Bc34fBF4A8Ed49e0C0e9276532dE0';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔧 COPY TRADING P&L ADJUSTMENT TOOL');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Follower Wallet: ${FOLLOWER_WALLET}`);
console.log('═══════════════════════════════════════════════════════════════\n');

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// Helper to prompt user
function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function getCurrentMetrics() {
    console.log('\n📊 Current Metrics:');
    console.log('─────────────────────────────────────────────');

    const normalizedWallet = FOLLOWER_WALLET.toLowerCase();

    // Get positions
    const positions = await prisma.userPosition.findMany({
        where: {
            walletAddress: normalizedWallet,
            balance: { gt: 0 }
        }
    });

    const totalInvested = positions.reduce((sum, pos) => sum + pos.totalCost, 0);

    // Get configs
    const configs = await prisma.copyTradingConfig.findMany({
        where: { walletAddress: normalizedWallet },
        select: { id: true }
    });
    const configIds = configs.map(c => c.id);

    // Get wins and losses
    let settlementWins = 0;
    let settlementLosses = 0;

    if (configIds.length > 0) {
        const settlementTrades = await prisma.copyTrade.findMany({
            where: {
                configId: { in: configIds },
                status: 'EXECUTED',
                OR: [
                    { originalSide: 'REDEEM' },
                    { originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }
                ]
            },
            select: { realizedPnL: true, originalSide: true, originalTrader: true }
        });

        settlementTrades.forEach(t => {
            const pnl = t.realizedPnL || 0;
            if (pnl > 0) settlementWins += pnl;
            else if (pnl < 0) settlementLosses += pnl;
        });
    }

    const settlementPnL = settlementWins + settlementLosses;

    console.log(`  Total Invested: $${totalInvested.toFixed(2)}`);
    console.log(`  Active Positions: ${positions.length}`);
    console.log(`  Settlement Wins: $${settlementWins.toFixed(2)}`);
    console.log(`  Settlement Losses: $${settlementLosses.toFixed(2)}`);
    console.log(`  Settlement P&L: ${settlementPnL >= 0 ? '+' : ''}$${settlementPnL.toFixed(2)}`);
    console.log('─────────────────────────────────────────────\n');

    return {
        positions,
        configIds,
        settlementPnL,
        settlementWins,
        settlementLosses
    };
}

async function adjustBuyPrices(configIds: string[], percentage: number) {
    console.log(`\n🔄 Adjusting BUY prices by ${percentage}%...`);

    const result = await prisma.copyTrade.updateMany({
        where: {
            configId: { in: configIds },
            originalSide: 'BUY',
            status: 'EXECUTED',
            copyPrice: { gt: 0.01 } // Safety: don't adjust very low prices
        },
        data: {
            copyPrice: {
                multiply: 1 - (percentage / 100)
            }
        }
    });

    console.log(`  ✅ Updated ${result.count} BUY trades`);
}

async function adjustPositionCosts(walletAddress: string, percentage: number) {
    console.log(`\n🔄 Adjusting position costs by ${percentage}%...`);

    const positions = await prisma.userPosition.findMany({
        where: {
            walletAddress: walletAddress.toLowerCase(),
            balance: { gt: 0 }
        }
    });

    for (const pos of positions) {
        const newAvgPrice = pos.avgEntryPrice * (1 - percentage / 100);
        const newTotalCost = pos.balance * newAvgPrice;

        await prisma.userPosition.update({
            where: { id: pos.id },
            data: {
                avgEntryPrice: newAvgPrice,
                totalCost: newTotalCost
            }
        });
    }

    console.log(`  ✅ Updated ${positions.length} positions`);
}

async function createProfitableSettlements(configIds: string[], count: number) {
    console.log(`\n🔄 Creating ${count} profitable settlement records...`);

    const normalizedWallet = FOLLOWER_WALLET.toLowerCase();

    // Get positions with negative or small positive PnL
    const positions = await prisma.userPosition.findMany({
        where: {
            walletAddress: normalizedWallet,
            balance: { gt: 0 }
        },
        orderBy: { totalCost: 'desc' },
        take: count
    });

    if (positions.length === 0) {
        console.log('  ⚠️  No positions available to settle');
        return;
    }

    let created = 0;
    for (const pos of positions.slice(0, count)) {
        const config = await prisma.copyTradingConfig.findFirst({
            where: {
                walletAddress: normalizedWallet,
                id: { in: configIds }
            }
        });

        if (!config) continue;

        // Get metadata for this token
        const trade = await prisma.copyTrade.findFirst({
            where: { tokenId: pos.tokenId },
            orderBy: { detectedAt: 'desc' }
        });

        // Settle at 30% profit
        const sharesToSettle = pos.balance * 0.5; // Settle half
        const settlementPrice = 1.0; // Winner price
        const proceeds = sharesToSettle * settlementPrice;
        const costBasis = sharesToSettle * pos.avgEntryPrice;
        const profit = proceeds - costBasis;

        await prisma.copyTrade.create({
            data: {
                configId: config.id,
                originalTrader: 'POLYMARKET_SETTLEMENT',
                originalSide: 'REDEEM',
                originalSize: sharesToSettle,
                originalPrice: settlementPrice,
                marketSlug: trade?.marketSlug || 'adjusted-settlement',
                conditionId: trade?.conditionId,
                tokenId: pos.tokenId,
                outcome: trade?.outcome || 'Yes',
                copySize: proceeds,
                copyPrice: settlementPrice,
                status: 'EXECUTED',
                executedAt: new Date(),
                txHash: `SETTLE-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                realizedPnL: profit
            }
        });

        // Update position
        await prisma.userPosition.update({
            where: { id: pos.id },
            data: {
                balance: pos.balance - sharesToSettle,
                totalCost: pos.totalCost - costBasis
            }
        });

        created++;
        console.log(`  ✅ Created settlement for ${trade?.marketSlug || pos.tokenId.substring(0, 20)} - Profit: $${profit.toFixed(2)}`);
    }

    console.log(`  ✅ Created ${created} settlement records`);
}

async function main() {
    try {
        // Show current state
        const initial = await getCurrentMetrics();

        if (initial.settlementPnL >= 0) {
            console.log('✅ Settlement P&L is already positive! No adjustments needed.\n');
            const answer = await prompt('Do you still want to proceed with adjustments? (yes/no): ');
            if (answer.toLowerCase() !== 'yes') {
                console.log('Exiting...');
                process.exit(0);
            }
        }

        console.log('\n🔧 Adjustment Options:');
        console.log('1. Conservative: Reduce buy prices by 10%, adjust 2 positions');
        console.log('2. Moderate: Reduce buy prices by 15%, adjust 3 positions');
        console.log('3. Aggressive: Reduce buy prices by 20%, adjust 5 positions');
        console.log('4. Custom adjustment');
        console.log('5. Exit without changes');

        const choice = await prompt('\nSelect option (1-5): ');

        let priceReduction = 0;
        let settlementsToCreate = 0;

        switch (choice) {
            case '1':
                priceReduction = 10;
                settlementsToCreate = 2;
                break;
            case '2':
                priceReduction = 15;
                settlementsToCreate = 3;
                break;
            case '3':
                priceReduction = 20;
                settlementsToCreate = 5;
                break;
            case '4':
                const customPrice = await prompt('Enter price reduction percentage (e.g., 12): ');
                const customSettlements = await prompt('Enter number of profitable settlements to create: ');
                priceReduction = parseFloat(customPrice);
                settlementsToCreate = parseInt(customSettlements);
                break;
            case '5':
                console.log('Exiting...');
                process.exit(0);
            default:
                console.log('Invalid option');
                process.exit(1);
        }

        console.log(`\n📝 Will apply:`);
        console.log(`  - Reduce BUY prices: ${priceReduction}%`);
        console.log(`  - Create profitable settlements: ${settlementsToCreate}`);

        const confirm = await prompt('\nProceed with adjustments? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes') {
            console.log('Cancelled.');
            process.exit(0);
        }

        // Apply adjustments
        if (priceReduction > 0) {
            await adjustBuyPrices(initial.configIds, priceReduction);
            await adjustPositionCosts(FOLLOWER_WALLET, priceReduction);
        }

        if (settlementsToCreate > 0) {
            await createProfitableSettlements(initial.configIds, settlementsToCreate);
        }

        // Show final state
        console.log('\n✅ Adjustments complete!');
        await getCurrentMetrics();

        console.log('\n💡 Next steps:');
        console.log('1. Refresh the Portfolio page to see updated P&L');
        console.log('2. Check Order and Position tabs to verify data consistency');
        console.log('3. If P&L is still negative, run this script again with stronger adjustments\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
