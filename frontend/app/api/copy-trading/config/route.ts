/**
 * Copy Trading Config API
 * 
 * CRUD operations for user's copy trading configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
            sideFilter,
            minTriggerSize,
            maxDaysOut,
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

        // Determine mode
        const copyMode = mode === 'fixed_amount' ? 'FIXED_AMOUNT' : 'PERCENTAGE';

        const config = await prisma.copyTradingConfig.create({
            data: {
                walletAddress: walletAddress.toLowerCase(),
                traderAddress: traderAddress.toLowerCase(),
                traderName: traderName || null,
                mode: copyMode,
                sizeScale: copyMode === 'PERCENTAGE' ? (sizeScale || 0.5) : null,
                fixedAmount: copyMode === 'FIXED_AMOUNT' ? (fixedAmount || 50) : null,
                maxSizePerTrade: maxSizePerTrade || 100,
                sideFilter: sideFilter || null,
                minTriggerSize: minTriggerSize || null,
                maxDaysOut: maxDaysOut || null,
                isActive: true,
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
