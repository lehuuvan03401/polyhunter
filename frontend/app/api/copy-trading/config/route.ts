/**
 * Copy Trading Config API
 * 
 * CRUD operations for user's copy trading configurations.
 */

import { polyClient } from '@/lib/polymarket';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EncryptionService } from '@/lib/encryption'; // Import EncryptionService


/**
 * GET /api/copy-trading/config
 * Get all copy trading configs for a wallet address
 */

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address' },
                { status: 400 }
            );
        }

        const configs = await prisma.copyTradingConfig.findMany({
            where: { walletAddress: walletAddress.toLowerCase() },
            include: {
                copyTrades: {
                    orderBy: { detectedAt: 'desc' },
                    take: 10, // Last 10 trades per config
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ configs });
    } catch (error) {
        console.error('Error fetching copy trading configs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch configs' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/copy-trading/config
 * Create a new copy trading configuration
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            walletAddress,
            traderAddress,
            traderName,
            mode,
            sizeScale,
            fixedAmount,
            maxSizePerTrade,
            minSizePerTrade,
            // Advanced mode settings
            infiniteMode,
            takeProfit,
            stopLoss,
            direction,
            // Filters
            sideFilter,
            minTriggerSize,
            maxDaysOut,
            maxPerMarket,
            minLiquidity,
            minVolume,
            maxOdds,
            // Sell strategy
            sellMode,
            sellFixedAmount,
            sellPercentage,

            // Execution Mode
            executionMode,
            privateKey,
            channel,
            autoExecute,

            // Strategy
            strategyProfile
        } = body;

        // Validation
        if (!walletAddress || !traderAddress) {
            return NextResponse.json(
                { error: 'Missing required fields: walletAddress, traderAddress' },
                { status: 400 }
            );
        }

        // Check if already copying this trader
        const existing = await prisma.copyTradingConfig.findFirst({
            where: {
                walletAddress: walletAddress.toLowerCase(),
                traderAddress: traderAddress.toLowerCase(),
                isActive: true,
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'Already copying this trader' },
                { status: 409 }
            );
        }

        // Fetch real trader profile if name not provided or generic
        let finalTraderName = traderName;
        if (!finalTraderName || finalTraderName.startsWith('Trader 0x')) {
            try {
                // @ts-ignore - Handle potential casing diffs in SDK types
                const profile = await polyClient.wallets.getWalletProfile(traderAddress) as any;
                if (profile?.username) {
                    finalTraderName = profile.username;
                    // @ts-ignore
                } else if (profile?.userName) {
                    // @ts-ignore
                    finalTraderName = profile.userName;
                }
            } catch (err) {
                console.warn('Failed to fetch trader profile name', err);
            }
        }

        // Determine mode: percentage, fixed_amount, or range
        let copyMode: 'PERCENTAGE' | 'FIXED_AMOUNT' = 'PERCENTAGE';
        if (mode === 'fixed_amount' || mode === 'Fixed $') {
            copyMode = 'FIXED_AMOUNT';
        }

        // Encryption logic for EOA Mode
        let encryptedKey: string | null = null;
        let iv: string | null = null;

        if (executionMode === 'EOA') {
            if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
                return NextResponse.json(
                    { error: 'Invalid Private Key for Speed Mode. Must be 64 hex chars with 0x prefix.' },
                    { status: 400 }
                );
            }
            try {
                const encrypted = EncryptionService.encrypt(privateKey);
                encryptedKey = encrypted.encryptedData;
                iv = encrypted.iv;
            } catch (e) {
                console.error("Encryption failed:", e);
                return NextResponse.json({ error: 'Encryption failed' }, { status: 500 });
            }
        }

        const config = await prisma.copyTradingConfig.create({
            data: {
                walletAddress: walletAddress.toLowerCase(),
                traderAddress: traderAddress.toLowerCase(),
                traderName: finalTraderName || null,
                mode: copyMode,
                sizeScale: sizeScale !== undefined ? Number(sizeScale) : null,
                fixedAmount: fixedAmount !== undefined ? Number(fixedAmount) : null,
                maxSizePerTrade: Number(maxSizePerTrade) || 100,
                minSizePerTrade: minSizePerTrade !== undefined ? Number(minSizePerTrade) : null,
                // Advanced mode settings
                infiniteMode: infiniteMode === true,
                takeProfit: takeProfit !== undefined ? Number(takeProfit) : null,
                stopLoss: stopLoss !== undefined ? Number(stopLoss) : null,
                direction: direction || 'COPY',
                // Filters
                sideFilter: sideFilter || null,
                minTriggerSize: minTriggerSize !== undefined ? Number(minTriggerSize) : null,
                maxDaysOut: maxDaysOut !== undefined ? Number(maxDaysOut) : null,
                maxPerMarket: maxPerMarket !== undefined ? Number(maxPerMarket) : null,
                minLiquidity: minLiquidity !== undefined ? Number(minLiquidity) : null,
                minVolume: minVolume !== undefined ? Number(minVolume) : null,
                maxOdds: maxOdds !== undefined ? Number(maxOdds) : null,
                // Sell strategy
                sellMode: sellMode || 'SAME_PERCENT',
                sellFixedAmount: sellFixedAmount !== undefined ? Number(sellFixedAmount) : null,
                sellPercentage: sellPercentage !== undefined ? Number(sellPercentage) : null,
                isActive: true,
                autoExecute: autoExecute || false,
                channel: channel || 'POLLING',
                executionMode: executionMode === 'EOA' ? 'EOA' : 'PROXY',
                encryptedKey,
                iv,
            },
        });

        return NextResponse.json({ config }, { status: 201 });
    } catch (error) {
        console.error('Error creating copy trading config:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Failed to create config: ${errorMessage}` },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/copy-trading/config
 * Delete a copy trading configuration
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('id');
        const walletAddress = searchParams.get('wallet');

        if (!configId || !walletAddress) {
            return NextResponse.json(
                { error: 'Missing id or wallet address' },
                { status: 400 }
            );
        }

        // Verify ownership
        const config = await prisma.copyTradingConfig.findFirst({
            where: {
                id: configId,
                walletAddress: walletAddress.toLowerCase(),
            },
        });

        if (!config) {
            return NextResponse.json(
                { error: 'Config not found or unauthorized' },
                { status: 404 }
            );
        }

        // Soft delete by setting isActive to false
        await prisma.copyTradingConfig.update({
            where: { id: configId },
            data: { isActive: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting copy trading config:', error);
        return NextResponse.json(
            { error: 'Failed to delete config' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/copy-trading/config
 * Update a copy trading configuration
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, walletAddress, ...updates } = body;

        if (!id || !walletAddress) {
            return NextResponse.json(
                { error: 'Missing id or wallet address' },
                { status: 400 }
            );
        }

        // Verify ownership
        const config = await prisma.copyTradingConfig.findFirst({
            where: {
                id,
                walletAddress: walletAddress.toLowerCase(),
            },
        });

        if (!config) {
            return NextResponse.json(
                { error: 'Config not found or unauthorized' },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (updates.sizeScale !== undefined) updateData.sizeScale = updates.sizeScale;
        if (updates.fixedAmount !== undefined) updateData.fixedAmount = updates.fixedAmount;
        if (updates.maxSizePerTrade !== undefined) updateData.maxSizePerTrade = updates.maxSizePerTrade;
        if (updates.sideFilter !== undefined) updateData.sideFilter = updates.sideFilter;
        if (updates.minTriggerSize !== undefined) updateData.minTriggerSize = updates.minTriggerSize;
        if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
        if (updates.strategyProfile !== undefined) updateData.strategyProfile = updates.strategyProfile;

        const updated = await prisma.copyTradingConfig.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ config: updated });
    } catch (error) {
        console.error('Error updating copy trading config:', error);
        return NextResponse.json(
            { error: 'Failed to update config' },
            { status: 500 }
        );
    }
}
