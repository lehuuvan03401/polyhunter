/**
 * Adjust Copy Trading Data to Target ROI and Volume
 * 
 * This script adjusts Settlement P&L to achieve a specific ROI based on total trading volume.
 * It can also increase total volume by injecting synthetic BUY trades.
 * 
 * Usage:
 * export $(grep -v '^#' .env | xargs)
 * npx tsx scripts/adjust-pnl-by-roi.ts --target-roi 8
 * npx tsx scripts/adjust-pnl-by-roi.ts --target-roi 15 --target-volume 1000
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local.secrets') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FOLLOWER_WALLET = process.env.FOLLOWER_WALLET || '0xfbEeDa7Fd22Bc34fBF4A8Ed49e0C0e9276532dE0';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 ROI-BASED P&L ADJUSTMENT TOOL');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Follower Wallet: ${FOLLOWER_WALLET}`);
console.log('═══════════════════════════════════════════════════════════════\n');

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

interface CurrentMetrics {
    totalVolume: number;
    totalInvested: number;
    settlementPnL: number;
    settlementWins: number;
    settlementLosses: number;
    positions: any[];
    configIds: string[];
}

async function getCurrentMetrics(): Promise<CurrentMetrics> {
    console.log('\n📊 Current Metrics:');
    console.log('─────────────────────────────────────────────');

    const normalizedWallet = FOLLOWER_WALLET.toLowerCase();

    // Get configs
    const configs = await prisma.copyTradingConfig.findMany({
        where: { walletAddress: normalizedWallet },
        select: { id: true }
    });
    const configIds = configs.map(c => c.id);

    if (configIds.length === 0) {
        throw new Error('No copy trading config found for this wallet');
    }

    // Get all executed trades
    const allTrades = await prisma.copyTrade.findMany({
        where: {
            configId: { in: configIds },
            status: 'EXECUTED'
        },
        select: { originalSide: true, copySize: true, realizedPnL: true, originalTrader: true }
    });

    // Calculate total volume (all BUY trades)
    const totalVolume = allTrades
        .filter(t => t.originalSide === 'BUY')
        .reduce((sum, t) => sum + t.copySize, 0);

    // Get positions
    const positions = await prisma.userPosition.findMany({
        where: {
            walletAddress: normalizedWallet,
            balance: { gt: 0 }
        }
    });

    const totalInvested = positions.reduce((sum, pos) => sum + pos.totalCost, 0);

    // Get settlement P&L
    let settlementWins = 0;
    let settlementLosses = 0;

    const settlementTrades = allTrades.filter(
        t => t.originalSide === 'REDEEM' ||
            ['POLYMARKET_SETTLEMENT', 'PROTOCOL'].includes(t.originalTrader || '')
    );

    settlementTrades.forEach(t => {
        const pnl = t.realizedPnL || 0;
        if (pnl > 0) settlementWins += pnl;
        else if (pnl < 0) settlementLosses += pnl;
    });

    const settlementPnL = settlementWins + settlementLosses;

    console.log(`  Total Volume (BUY): $${totalVolume.toFixed(2)}`);
    console.log(`  Total Invested: $${totalInvested.toFixed(2)}`);
    console.log(`  Settlement Wins: $${settlementWins.toFixed(2)}`);
    console.log(`  Settlement Losses: $${settlementLosses.toFixed(2)}`);
    console.log(`  Settlement P&L: ${settlementPnL >= 0 ? '+' : ''}$${settlementPnL.toFixed(2)}`);

    if (totalVolume > 0) {
        const currentROI = (settlementPnL / totalVolume) * 100;
        console.log(`  Current ROI: ${currentROI >= 0 ? '+' : ''}${currentROI.toFixed(2)}%`);
    }

    console.log('─────────────────────────────────────────────\n');

    return {
        totalVolume,
        totalInvested,
        settlementPnL,
        settlementWins,
        settlementLosses,
        positions,
        configIds
    };
}

async function adjustToTargetROI(targetROI: number, targetVolume?: number) {
    let metrics = await getCurrentMetrics();

    // Step 1: If target volume is specified and higher than current, inject volume first
    if (targetVolume && targetVolume > metrics.totalVolume) {
        const volumeGap = targetVolume - metrics.totalVolume;
        console.log(`\n📈 Target Volume: $${targetVolume.toFixed(2)}`);
        console.log(`📊 Current Volume: $${metrics.totalVolume.toFixed(2)}`);
        console.log(`📈 Volume Gap: +$${volumeGap.toFixed(2)}\n`);

        await injectVolume(metrics, volumeGap);

        // Refresh metrics after volume injection
        metrics = await getCurrentMetrics();
    }

    // Step 2: Adjust P&L to hit target ROI
    const targetPnL = metrics.totalVolume * (targetROI / 100);
    const currentPnL = metrics.settlementPnL;
    const gap = targetPnL - currentPnL;

    console.log(`🎯 Target ROI: ${targetROI}%`);
    console.log(`📊 Target P&L: $${targetPnL.toFixed(2)}`);
    console.log(`📊 Current P&L: $${currentPnL.toFixed(2)}`);
    console.log(`📈 Gap: ${gap >= 0 ? '+' : ''}$${gap.toFixed(2)}\n`);

    if (Math.abs(gap) < 10) {
        console.log('✅ Current P&L is already very close to target! No adjustment needed.\n');
        return;
    }

    // Strategy: Adjust by modifying settlement wins/losses
    if (gap > 0) {
        // Need to increase P&L - add more wins or reduce losses
        console.log(`💡 Strategy: Add ${Math.ceil(gap / 500)} profitable settlements\n`);
        await addProfitableSettlements(metrics, gap);
    } else {
        // Need to decrease P&L - add more losses or reduce wins
        console.log(`💡 Strategy: Adjust existing settlements to reduce P&L\n`);
        await reducePnL(metrics, Math.abs(gap));
    }

    // Show final metrics
    console.log('\n✅ Adjustment complete!\n');
    await getCurrentMetrics();
}

async function injectVolume(metrics: CurrentMetrics, volumeToAdd: number) {
    const normalizedWallet = FOLLOWER_WALLET.toLowerCase();

    const config = await prisma.copyTradingConfig.findFirst({
        where: {
            walletAddress: normalizedWallet,
            id: { in: metrics.configIds }
        }
    });

    if (!config) {
        console.log('⚠️  No config found');
        return;
    }

    console.log(`🔄 Injecting $${volumeToAdd.toFixed(2)} additional trading volume...`);

    // Create multiple synthetic BUY trades to increase volume
    const numTrades = Math.ceil(volumeToAdd / 50); // ~$50 per trade for realistic look
    const volumePerTrade = volumeToAdd / numTrades;
    const avgPrice = 0.65; // Typical entry price
    const sharesPerTrade = volumePerTrade / avgPrice;

    for (let i = 0; i < numTrades; i++) {
        const tokenId = `synth-volume-${Date.now()}-${i}`;

        // Create a BUY trade
        await prisma.copyTrade.create({
            data: {
                configId: config.id,
                originalTrader: config.traderAddress, // Fixed: was targetTrader
                originalSide: 'BUY',
                originalSize: sharesPerTrade,
                originalPrice: avgPrice,
                marketSlug: 'volume-adjustment-synthetic',
                conditionId: null,
                tokenId,
                outcome: 'Yes',
                copySize: volumePerTrade,
                copyPrice: avgPrice,
                status: 'EXECUTED',
                executedAt: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
                txHash: `ADJUST-VOL-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                realizedPnL: 0
            }
        });

        // Create corresponding position
        await prisma.userPosition.create({
            data: {
                walletAddress: normalizedWallet,
                tokenId,
                balance: sharesPerTrade,
                avgEntryPrice: avgPrice,
                totalCost: volumePerTrade
            }
        });
    }

    console.log(`  ✅ Injected ${numTrades} synthetic trades totaling $${volumeToAdd.toFixed(2)}\n`);
}

async function addProfitableSettlements(metrics: CurrentMetrics, targetGain: number) {
    const normalizedWallet = FOLLOWER_WALLET.toLowerCase();
    const positions = metrics.positions.filter(p => p.balance > 0);

    const config = await prisma.copyTradingConfig.findFirst({
        where: {
            walletAddress: normalizedWallet,
            id: { in: metrics.configIds }
        }
    });

    if (!config) {
        console.log('⚠️  No config found');
        return;
    }

    let totalProfitAdded = 0;
    const remainingTarget = targetGain;

    // Strategy 1: Settle existing positions at profit (with partial settlement support)
    if (positions.length > 0) {
        console.log(`🔄 Creating profitable settlement records from ${positions.length} positions...`);

        // Sort positions by potential profit (highest first for efficiency)
        const sortedPositions = positions
            .map(pos => ({
                ...pos,
                potentialProfit: pos.balance - pos.totalCost // profit if settled at $1
            }))
            .filter(p => p.potentialProfit > 0) // Only profitable positions
            .sort((a, b) => b.potentialProfit - a.potentialProfit);

        for (const pos of sortedPositions) {
            const remainingGap = remainingTarget - totalProfitAdded;
            if (remainingGap <= 5) break; // Close enough to target

            // Get metadata for this token
            const trade = await prisma.copyTrade.findFirst({
                where: { tokenId: pos.tokenId },
                orderBy: { detectedAt: 'desc' }
            });

            // Calculate profit per share = 1.0 - avgEntryPrice
            const settlementPrice = 1.0;
            const profitPerShare = settlementPrice - pos.avgEntryPrice;

            if (profitPerShare <= 0) {
                console.log(`  ⏭️  Skipping ${trade?.marketSlug || pos.tokenId.substring(0, 20)} (no profit margin)`);
                continue;
            }

            // Calculate how many shares to settle to exactly hit the remaining gap
            const fullProfit = pos.balance * profitPerShare;

            let sharesToSettle: number;
            let actualProfit: number;

            if (fullProfit <= remainingGap) {
                // Settle all shares - won't overshoot
                sharesToSettle = pos.balance;
                actualProfit = fullProfit;
            } else {
                // Partial settlement to hit target exactly
                sharesToSettle = remainingGap / profitPerShare;
                actualProfit = remainingGap;
                console.log(`  📐 Partial settlement: ${sharesToSettle.toFixed(4)} of ${pos.balance.toFixed(4)} shares`);
            }

            const proceeds = sharesToSettle * settlementPrice;
            const costBasis = sharesToSettle * pos.avgEntryPrice;

            await prisma.copyTrade.create({
                data: {
                    configId: config.id,
                    originalTrader: 'POLYMARKET_SETTLEMENT',
                    originalSide: 'REDEEM',
                    originalSize: sharesToSettle,
                    originalPrice: settlementPrice,
                    marketSlug: trade?.marketSlug || 'roi-adjusted-settlement',
                    conditionId: trade?.conditionId,
                    tokenId: pos.tokenId,
                    outcome: trade?.outcome || 'Yes',
                    copySize: proceeds,
                    copyPrice: settlementPrice,
                    status: 'EXECUTED',
                    executedAt: new Date(),
                    txHash: `ADJUST-SETTLE-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    realizedPnL: actualProfit
                }
            });

            // Update position (partial or full)
            await prisma.userPosition.update({
                where: { id: pos.id },
                data: {
                    balance: pos.balance - sharesToSettle,
                    totalCost: pos.totalCost - costBasis
                }
            });

            totalProfitAdded += actualProfit;
            console.log(`  ✅ Settled ${trade?.marketSlug || pos.tokenId.substring(0, 20)} - Profit: $${actualProfit.toFixed(2)}`);
        }
    }

    // Strategy 2: If still not enough, inject direct profit settlements
    const remainingGap = targetGain - totalProfitAdded;
    if (remainingGap > 5) {
        console.log(`\n🔄 Injecting direct profit of $${remainingGap.toFixed(2)} (positions insufficient)...`);

        // Create a synthetic profitable settlement
        const syntheticProfit = remainingGap;

        await prisma.copyTrade.create({
            data: {
                configId: config.id,
                originalTrader: 'POLYMARKET_SETTLEMENT',
                originalSide: 'REDEEM',
                originalSize: syntheticProfit,
                originalPrice: 1.0,
                marketSlug: 'roi-adjustment-synthetic',
                conditionId: null,
                tokenId: `synthetic-${Date.now()}`,
                outcome: 'Yes',
                copySize: syntheticProfit,
                copyPrice: 1.0,
                status: 'EXECUTED',
                executedAt: new Date(),
                txHash: `ADJUST-SYNTH-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                realizedPnL: syntheticProfit
            }
        });

        totalProfitAdded += syntheticProfit;
        console.log(`  ✅ Injected synthetic profit: $${syntheticProfit.toFixed(2)}`);
    }

    console.log(`\n📊 Total profit added: $${totalProfitAdded.toFixed(2)}`);
}

async function reducePnL(metrics: CurrentMetrics, targetReduction: number) {
    console.log(`🔄 Reducing P&L by $${targetReduction.toFixed(2)}...`);

    const normalizedWallet = FOLLOWER_WALLET.toLowerCase();

    // Strategy: Remove or reduce some profitable settlements
    const profitableSettlements = await prisma.copyTrade.findMany({
        where: {
            configId: { in: metrics.configIds },
            status: 'EXECUTED',
            OR: [
                { originalSide: 'REDEEM' },
                { originalTrader: { in: ['POLYMARKET_SETTLEMENT', 'PROTOCOL'] } }
            ],
            realizedPnL: { gt: 0 }
        },
        orderBy: { realizedPnL: 'desc' }
    });

    let reduced = 0;
    let count = 0;

    for (const settlement of profitableSettlements) {
        if (reduced >= targetReduction) break;

        const reductionAmount = Math.min(settlement.realizedPnL || 0, targetReduction - reduced);
        const newPnL = (settlement.realizedPnL || 0) - reductionAmount;

        if (newPnL <= 0) {
            // Delete this settlement
            await prisma.copyTrade.delete({ where: { id: settlement.id } });
            console.log(`  ✅ Removed settlement (was $${settlement.realizedPnL?.toFixed(2)})`);
        } else {
            // Reduce the profit
            await prisma.copyTrade.update({
                where: { id: settlement.id },
                data: { realizedPnL: newPnL }
            });
            console.log(`  ✅ Reduced settlement profit: $${settlement.realizedPnL?.toFixed(2)} → $${newPnL.toFixed(2)}`);
        }

        reduced += reductionAmount;
        count++;
    }

    console.log(`  Modified ${count} settlement records, reduced P&L by $${reduced.toFixed(2)}`);
}

async function main() {
    try {
        // Get target ROI from command line args
        const args = process.argv.slice(2);
        const targetROIIndex = args.indexOf('--target-roi');
        const targetVolumeIndex = args.indexOf('--target-volume');

        let targetROI = 8; // Default 8%
        let targetVolume: number | undefined;

        if (targetROIIndex !== -1 && args[targetROIIndex + 1]) {
            targetROI = parseFloat(args[targetROIIndex + 1]);
        }

        if (targetVolumeIndex !== -1 && args[targetVolumeIndex + 1]) {
            targetVolume = parseFloat(args[targetVolumeIndex + 1]);
        }

        if (isNaN(targetROI)) {
            console.error('❌ Invalid target ROI. Please provide a number.');
            process.exit(1);
        }

        if (targetVolume !== undefined && isNaN(targetVolume)) {
            console.error('❌ Invalid target volume. Please provide a number.');
            process.exit(1);
        }

        await adjustToTargetROI(targetROI, targetVolume);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
