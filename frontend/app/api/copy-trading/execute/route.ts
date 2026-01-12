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

            // --- OPTION B: PROXY FUND MANAGEMENT ---
            // 
            // Flow:
            // 1. Check if user has Proxy with sufficient funds
            // 2. Transfer USDC from Proxy to Bot
            // 3. Bot executes CLOB order
            // 4. Transfer result tokens back to Proxy
            //

            const signer = getBotSigner();
            let proxyAddress: string | null = null;
            let useProxyFunds = false;
            let fundTransferTxHash: string | undefined;

            if (signer) {
                try {
                    const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
                    if (addresses.proxyFactory) {
                        const factory = new ethers.Contract(addresses.proxyFactory, PROXY_FACTORY_ABI, signer);
                        const userProxy = await factory.getUserProxy(walletAddress);
                        if (userProxy && userProxy !== ethers.constants.AddressZero) {
                            proxyAddress = userProxy;
                            console.log(`[Execute] User has Proxy: ${proxyAddress}`);

                            // Check Proxy balance
                            const proxyBalance = await getProxyUsdcBalance(proxyAddress!, signer);
                            console.log(`[Execute] Proxy USDC balance: $${proxyBalance.toFixed(2)}`);

                            if (proxyBalance >= trade.copySize) {
                                // Sufficient funds - transfer from Proxy to Bot
                                console.log(`[Execute] Transferring $${trade.copySize} from Proxy to Bot...`);
                                const transferResult = await transferFromProxy(proxyAddress!, trade.copySize, signer);

                                if (transferResult.success) {
                                    useProxyFunds = true;
                                    fundTransferTxHash = transferResult.txHash;
                                    console.log(`[Execute] Fund transfer successful: ${fundTransferTxHash}`);
                                } else {
                                    console.error(`[Execute] Fund transfer failed: ${transferResult.error}`);
                                    return NextResponse.json({
                                        success: false,
                                        error: `Failed to transfer funds from Proxy: ${transferResult.error}`,
                                    });
                                }
                            } else {
                                console.log(`[Execute] Insufficient Proxy funds ($${proxyBalance} < $${trade.copySize})`);
                                return NextResponse.json({
                                    success: false,
                                    error: `Insufficient Proxy balance. Need $${trade.copySize.toFixed(2)}, have $${proxyBalance.toFixed(2)}`,
                                    requiresDeposit: true,
                                    proxyAddress,
                                });
                            }
                        }
                    }
                } catch (e: any) {
                    console.error('[Execute] Failed to check/transfer from Proxy:', e);
                    return NextResponse.json({
                        success: false,
                        error: `Proxy operation failed: ${e.message}`,
                    });
                }
            }

            // If no Proxy or Proxy check failed, require manual execution
            if (!proxyAddress) {
                return NextResponse.json({
                    success: false,
                    requiresManualExecution: true,
                    message: 'No Proxy wallet found. User must execute manually via frontend wallet.',
                    trade: {
                        id: trade.id,
                        tokenId: trade.tokenId,
                        side: trade.originalSide,
                        size: trade.copySize,
                        price: trade.originalPrice,
                    },
                });
            }

            // --- CLOB ORDER EXECUTION ---

            const { TradingService, RateLimiter, createUnifiedCache } = await import('@catalyst-team/poly-sdk');

            const rateLimiter = new RateLimiter();
            const cache = createUnifiedCache();
            const tradingService = new TradingService(rateLimiter, cache, {
                privateKey: TRADING_PRIVATE_KEY,
                chainId: CHAIN_ID,
            });
            await tradingService.initialize();

            let orderResult;
            try {
                if (orderMode === 'market') {
                    orderResult = await tradingService.createMarketOrder({
                        tokenId: trade.tokenId,
                        side: trade.originalSide as 'BUY' | 'SELL',
                        amount: trade.copySize,
                        price: trade.originalPrice * (1 + slippage), // Apply slippage tolerance
                    });
                } else {
                    // For limit orders, we need to calculate size in shares (amount / price)
                    // But createLimitOrder usually takes size in raw units. 
                    // Let's assume trade.copySize is in USDC amount for now as per `detect` logic.
                    // IMPORTANT: Limit orders need size in shares.
                    const size = trade.copySize / trade.originalPrice;

                    orderResult = await tradingService.createLimitOrder({
                        tokenId: trade.tokenId,
                        side: trade.originalSide as 'BUY' | 'SELL',
                        price: trade.originalPrice,
                        size: size,
                    });
                }
            } catch (err: any) {
                orderResult = {
                    success: false,
                    errorMsg: err.message || 'Unknown execution error',
                    orderId: '',
                    transactionHashes: []
                };
            }

            if (orderResult.success) {
                let returnTransferTxHash: string | undefined;

                // OPTION B: Transfer result tokens back to Proxy
                if (useProxyFunds && proxyAddress && signer) {
                    try {
                        const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;

                        if (trade.originalSide === 'BUY') {
                            // For BUY orders: Bot received CTF tokens, transfer to Proxy
                            // Note: CTF tokens use 6 decimals like USDC
                            const sharesReceived = trade.copySize / trade.originalPrice;
                            console.log(`[Execute] Returning ${sharesReceived.toFixed(4)} tokens to Proxy...`);

                            // CTF tokens are at trade.tokenId address (simplified - in reality need CTF contract)
                            // For now, we log the intent - full CTF transfer requires more contract work
                            console.log(`[Execute] Token ID: ${trade.tokenId}`);
                            console.log(`[Execute] Note: CTF token transfer to Proxy pending - tokens held in Bot for user`);

                            // TODO: Implement actual CTF token transfer
                            // This requires calling the CTF contract's safeTransferFrom
                        } else {
                            // For SELL orders: Bot received USDC, transfer to Proxy
                            const usdcReceived = trade.copySize;
                            console.log(`[Execute] Returning $${usdcReceived.toFixed(2)} USDC to Proxy...`);

                            const returnResult = await transferToProxy(
                                proxyAddress,
                                addresses.usdc,
                                usdcReceived,
                                USDC_DECIMALS,
                                signer
                            );

                            if (returnResult.success) {
                                returnTransferTxHash = returnResult.txHash;
                                console.log(`[Execute] USDC returned to Proxy: ${returnTransferTxHash}`);
                            } else {
                                console.error(`[Execute] Failed to return USDC to Proxy: ${returnResult.error}`);
                                // Don't fail the trade - funds are safe in Bot wallet
                            }
                        }
                    } catch (returnError: any) {
                        console.error(`[Execute] Token return error: ${returnError.message}`);
                        // Don't fail the trade - funds are safe in Bot wallet
                    }
                }

                const updatedTrade = await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'EXECUTED',
                        executedAt: new Date(),
                        txHash: orderResult.transactionHashes?.[0] || orderResult.orderId,
                    },
                });

                return NextResponse.json({
                    success: true,
                    orderId: orderResult.orderId,
                    transactionHashes: orderResult.transactionHashes,
                    fundTransferTxHash,
                    returnTransferTxHash,
                    trade: updatedTrade,
                    useProxyFunds,
                });
            } else {
                // Order failed - need to return funds to Proxy
                if (useProxyFunds && proxyAddress && signer) {
                    console.log(`[Execute] Order failed, returning $${trade.copySize} to Proxy...`);
                    const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;

                    const refundResult = await transferToProxy(
                        proxyAddress,
                        addresses.usdc,
                        trade.copySize,
                        USDC_DECIMALS,
                        signer
                    );

                    if (refundResult.success) {
                        console.log(`[Execute] Refund complete: ${refundResult.txHash}`);
                    } else {
                        console.error(`[Execute] Refund failed: ${refundResult.error}`);
                    }
                }

                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: orderResult.errorMsg,
                    },
                });

                return NextResponse.json({
                    success: false,
                    error: orderResult.errorMsg || 'Order execution failed',
                    fundsReturned: useProxyFunds,
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
