/**
 * Copy Trading Config API
 * 
 * CRUD operations for user's copy trading configurations.
 */

import { polyClient } from '@/lib/polymarket';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EncryptionService } from '@/lib/encryption'; // Import EncryptionService

const redactConfigSecrets = (config: any) => {
    if (!config) return config;
    return {
        ...config,
        // 任何返回到客户端的配置对象都必须脱敏，避免密钥二次泄漏。
        encryptedKey: null,
        iv: null,
        apiKey: null,
        apiSecret: null,
        apiPassphrase: null,
    };
};

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

        const sanitized = configs.map(redactConfigSecrets);
        return NextResponse.json({ configs: sanitized });
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
            strategyProfile,

            // API Credentials
            apiKey,
            apiSecret,
            apiPassphrase
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

        // 若前端未提供有效昵称，则回源查询 trader profile 补齐展示名。
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

        // 统一映射前端模式字段到数据库枚举，避免多种别名写入 DB。
        let copyMode: 'PERCENTAGE' | 'FIXED_AMOUNT' = 'PERCENTAGE';
        if (mode === 'fixed_amount' || mode === 'Fixed $') {
            copyMode = 'FIXED_AMOUNT';
        }

        // EOA 私钥只允许以密文入库，明文仅在请求上下文存在。
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

        // API 凭据按 “iv:ciphertext” 合并存储，便于单字段管理。
        const encryptField = (text: string): string | null => {
            if (!text) return null;
            try {
                const { encryptedData, iv } = EncryptionService.encrypt(text);
                return `${iv}:${encryptedData}`; // Store IV with data
            } catch (e) {
                console.error("Encryption failed for field:", e);
                return null;
            }
        };

        const encryptedApiKey = encryptField(apiKey);
        const encryptedApiSecret = encryptField(apiSecret);
        const encryptedApiPassphrase = encryptField(apiPassphrase);

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
                apiKey: encryptedApiKey,
                apiSecret: encryptedApiSecret,
                apiPassphrase: encryptedApiPassphrase,
            },
        });

        return NextResponse.json({ config: redactConfigSecrets(config) }, { status: 201 });
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

        // 软删除而非硬删除：保留历史交易关联与审计可追溯性。
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

        // 白名单式更新：只接受明确允许的字段，避免误改关键配置。
        const updateData: Record<string, unknown> = {};
        if (updates.sizeScale !== undefined) updateData.sizeScale = updates.sizeScale;
        if (updates.fixedAmount !== undefined) updateData.fixedAmount = updates.fixedAmount;
        if (updates.maxSizePerTrade !== undefined) updateData.maxSizePerTrade = updates.maxSizePerTrade;
        if (updates.sideFilter !== undefined) updateData.sideFilter = updates.sideFilter;
        if (updates.minTriggerSize !== undefined) updateData.minTriggerSize = updates.minTriggerSize;
        if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
        if (updates.strategyProfile !== undefined) updateData.strategyProfile = updates.strategyProfile;

        // API 凭据更新同样走加密路径，禁止明文覆写。
        const encryptFieldUpdate = (text: string) => {
            const { encryptedData, iv } = EncryptionService.encrypt(text);
            return `${iv}:${encryptedData}`;
        };

        if (updates.apiKey) updateData.apiKey = encryptFieldUpdate(updates.apiKey);
        if (updates.apiSecret) updateData.apiSecret = encryptFieldUpdate(updates.apiSecret);
        if (updates.apiPassphrase) updateData.apiPassphrase = encryptFieldUpdate(updates.apiPassphrase);

        const updated = await prisma.copyTradingConfig.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ config: redactConfigSecrets(updated) });
    } catch (error) {
        console.error('Error updating copy trading config:', error);
        return NextResponse.json(
            { error: 'Failed to update config' },
            { status: 500 }
        );
    }
}
