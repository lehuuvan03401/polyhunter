/**
 * Copy Trading Execute API
 * 
 * Execute pending copy trades through Polymarket CLOB
 * Supports both manual (frontend) and automatic (server-side) execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Trading configuration from environment
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';

// Imports for Proxy Execution
import { ethers } from 'ethers';
import { PROXY_FACTORY_ABI, POLY_HUNTER_PROXY_ABI, ERC20_ABI, CONTRACT_ADDRESSES, USDC_DECIMALS } from '@/lib/contracts/abis';

// Helper to get provider and signer
const getBotSigner = () => {
    if (!TRADING_PRIVATE_KEY) return null;
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    return new ethers.Wallet(TRADING_PRIVATE_KEY, provider);
};

// ============================================================================
// OPTION B: Proxy Fund Management Helpers
// ============================================================================

/**
 * Get USDC balance of a Proxy wallet
 */
async function getProxyUsdcBalance(proxyAddress: string, signer: ethers.Wallet): Promise<number> {
    const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
    const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, signer);
    const balance = await usdc.balanceOf(proxyAddress);
    return Number(balance) / (10 ** USDC_DECIMALS);
}

/**
 * Transfer USDC from Proxy to Bot wallet
 * Bot must be set as Operator on the Proxy
 */
async function transferFromProxy(
    proxyAddress: string,
    amount: number,
    signer: ethers.Wallet
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
        const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);
        const botAddress = signer.address;

        // Encode USDC transfer call
        const usdcInterface = new ethers.utils.Interface(ERC20_ABI);
        const amountWei = ethers.utils.parseUnits(amount.toString(), USDC_DECIMALS);
        const transferData = usdcInterface.encodeFunctionData('transfer', [botAddress, amountWei]);

        // Execute transfer through proxy
        console.log(`[Proxy] Transferring $${amount} USDC from Proxy to Bot...`);
        const tx = await proxy.execute(addresses.usdc, transferData);
        const receipt = await tx.wait();

        console.log(`[Proxy] Transfer complete: ${receipt.transactionHash}`);
        return { success: true, txHash: receipt.transactionHash };
    } catch (error: any) {
        console.error('[Proxy] Transfer from Proxy failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer tokens (USDC or CTF) from Bot back to Proxy
 */
async function transferToProxy(
    proxyAddress: string,
    tokenAddress: string,
    amount: number,
    decimals: number,
    signer: ethers.Wallet
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const amountWei = ethers.utils.parseUnits(amount.toString(), decimals);

        console.log(`[Proxy] Transferring tokens back to Proxy...`);
        const tx = await token.transfer(proxyAddress, amountWei);
        const receipt = await tx.wait();

        console.log(`[Proxy] Return transfer complete: ${receipt.transactionHash}`);
        return { success: true, txHash: receipt.transactionHash };
    } catch (error: any) {
        console.error('[Proxy] Transfer to Proxy failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * POST /api/copy-trading/execute
 * Execute or mark a pending copy trade
 * 
 * Body: {
 *   tradeId: string,
 *   walletAddress: string,
 *   
 *   // For manual execution (frontend already executed):
 *   txHash?: string,
 *   status?: 'executed' | 'failed' | 'skipped',
 *   errorMessage?: string,
 *   
 *   // For server-side execution:
 *   executeOnServer?: boolean,
 *   orderMode?: 'market' | 'limit',
 *   slippage?: number,  // For market orders, default 2%
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            tradeId,
            walletAddress,
            txHash,
            status,
            errorMessage,
            executeOnServer = false,
            orderMode = 'limit',
            slippage = 0.02,
        } = body;

        if (!tradeId || !walletAddress) {
            return NextResponse.json(
                { error: 'Missing tradeId or walletAddress' },
                { status: 400 }
            );
        }

        // Find the trade and verify ownership
        const trade = await prisma.copyTrade.findFirst({
            where: {
                id: tradeId,
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                },
            },
            include: {
                config: true,
            },
        });

        if (!trade) {
            return NextResponse.json(
                { error: 'Trade not found or unauthorized' },
                { status: 404 }
            );
        }

        if (trade.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Trade is not in pending status', currentStatus: trade.status },
                { status: 400 }
            );
        }

        // === SERVER-SIDE EXECUTION ===
        if (executeOnServer) {
            if (!TRADING_PRIVATE_KEY) {
                return NextResponse.json({
                    success: false,
                    requiresManualExecution: true,
                    message: 'Server-side trading not configured. Execute manually via wallet.',
                    trade: {
                        id: trade.id,
                        tokenId: trade.tokenId,
                        side: trade.originalSide,
                        size: trade.copySize,
                        price: trade.originalPrice,
                    },
                });
            }

            if (!trade.tokenId) {
                return NextResponse.json({
                    success: false,
                    error: 'Trade has no tokenId - cannot execute on CLOB',
                });
            }

            // --- EXECUTION VIA SERVICE ---
            try {
                // Dynamic import to avoid build-time issues if any
                const { TradingService, RateLimiter, createUnifiedCache, CopyTradingExecutionService } = await import('@catalyst-team/poly-sdk');
                const { ethers } = await import('ethers');

                // Initialize Trading Service
                const rateLimiter = new RateLimiter();
                const cache = createUnifiedCache();
                const tradingService = new TradingService(rateLimiter, cache, {
                    privateKey: TRADING_PRIVATE_KEY,
                    chainId: CHAIN_ID,
                });
                await tradingService.initialize();

                // Initialize Execution Service
                const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
                const signer = new ethers.Wallet(TRADING_PRIVATE_KEY, provider);
                const executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID);

                // Execute
                const result = await executionService.executeOrderWithProxy({
                    tradeId: trade.id,
                    walletAddress: walletAddress,
                    tokenId: trade.tokenId,
                    side: trade.originalSide as 'BUY' | 'SELL',
                    amount: trade.copySize, // In USDC
                    price: trade.originalPrice,
                    slippage: trade.config.slippageType === 'FIXED' ? (trade.config.maxSlippage / 100) : undefined,
                    maxSlippage: trade.config.maxSlippage,
                    slippageMode: trade.config.slippageType as 'FIXED' | 'AUTO',
                    orderType: orderMode as 'market' | 'limit',
                });

                // Update DB based on result
                if (result.success) {
                    const updatedTrade = await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: 'EXECUTED',
                            executedAt: new Date(),
                            txHash: result.transactionHashes?.[0] || result.orderId,
                            usedBotFloat: result.usedBotFloat ?? false,
                        },
                    });

                    return NextResponse.json({
                        success: true,
                        orderId: result.orderId,
                        transactionHashes: result.transactionHashes,
                        fundTransferTxHash: result.fundTransferTxHash,
                        returnTransferTxHash: result.returnTransferTxHash,
                        trade: updatedTrade,
                        useProxyFunds: result.useProxyFunds,
                    });
                } else {
                    await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: 'FAILED',
                            errorMessage: result.error,
                        },
                    });

                    return NextResponse.json({
                        success: false,
                        error: result.error || 'Order execution failed',
                        fundsReturned: result.useProxyFunds, // Service handles returns
                    });
                }

            } catch (serviceError: any) {
                console.error('[Execute] Service error:', serviceError);
                return NextResponse.json({
                    success: false,
                    error: `Execution service failed: ${serviceError.message}`,
                });
            }
        }

        // === MANUAL EXECUTION (Frontend already executed) ===
        const executionStatus = status === 'executed' ? 'EXECUTED' :
            status === 'failed' ? 'FAILED' :
                status === 'skipped' ? 'SKIPPED' : 'FAILED';

        const updatedTrade = await prisma.copyTrade.update({
            where: { id: tradeId },
            data: {
                status: executionStatus,
                txHash: txHash || null,
                errorMessage: errorMessage || null,
                executedAt: executionStatus === 'EXECUTED' ? new Date() : null,
            },
        });

        return NextResponse.json({
            success: true,
            trade: updatedTrade
        });
    } catch (error) {
        console.error('Error executing copy trade:', error);
        return NextResponse.json(
            { error: 'Failed to execute trade', message: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/copy-trading/execute
 * Get pending trades that need user confirmation
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

        // Get pending trades that haven't expired
        const pendingTrades = await prisma.copyTrade.findMany({
            where: {
                config: {
                    walletAddress: walletAddress.toLowerCase(),
                    isActive: true,
                },
                status: 'PENDING',
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                config: {
                    select: {
                        traderName: true,
                        traderAddress: true,
                    },
                },
            },
            orderBy: { detectedAt: 'desc' },
        });

        // Expire old pending trades
        await prisma.copyTrade.updateMany({
            where: {
                status: 'PENDING',
                expiresAt: {
                    lt: new Date(),
                },
            },
            data: {
                status: 'EXPIRED',
            },
        });

        return NextResponse.json({ pendingTrades });
    } catch (error) {
        console.error('Error fetching pending trades:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending trades' },
            { status: 500 }
        );
    }
}
